import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, spaces } from '@/lib/db/schema';
import { decrypt } from '@/lib/encrypt';
import { fetchWorkflowRuns, fetchOpenIssues, fetchOpenPRs, fetchRecentlyMergedPRs, fetchRunJobs, fetchJobLogsSnippet } from '@/lib/github';
import { buildAgentStatus, buildActivityFeed, type JobsMap } from '@/lib/build-agent-status';
import { eq, and } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import type { SpaceStatusResponse } from '@/lib/types';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const shareToken = req.nextUrl.searchParams.get('token');

  // Resolve space + owner
  let space;
  if (shareToken) {
    space = await db.query.spaces.findFirst({
      where: and(eq(spaces.id, id), eq(spaces.share_token, shareToken), eq(spaces.share_enabled, true)),
    });
    if (!space) return NextResponse.json({ error: 'Not found' }, { status: 403 });
  } else {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    space = await db.query.spaces.findFirst({
      where: and(eq(spaces.id, id), eq(spaces.owner_id, session.user.id)),
    });
    if (!space) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const owner = await db.query.users.findFirst({ where: eq(users.id, space.owner_id) });
  if (!owner) return NextResponse.json({ error: 'Owner not found' }, { status: 500 });

  const token = decrypt(owner.github_token_enc);
  const repo = space.repo_full_name;

  const [runsData, openIssues, openPRs, mergedPRs] = await Promise.all([
    fetchWorkflowRuns(repo, token),
    fetchOpenIssues(repo, token),
    fetchOpenPRs(repo, token),
    fetchRecentlyMergedPRs(repo, token),
  ]);

  // Fetch step-level detail for all active (in_progress) runs in parallel
  const activeRuns = runsData.workflow_runs.filter((r) => r.status === 'in_progress');
  const jobsEntries = await Promise.all(
    activeRuns.map(async (run) => {
      try {
        const { jobs } = await fetchRunJobs(repo, run.id, token);
        return [run.id, jobs] as const;
      } catch {
        return null;
      }
    })
  );
  const jobsMap: JobsMap = new Map(
    jobsEntries.filter((e): e is [number, Awaited<ReturnType<typeof fetchRunJobs>>['jobs']] => e !== null)
  );

  // Fetch last ~4KB of logs for each active job so the UI can show live output
  const logSnippetsMap = new Map<number, string | null>();
  await Promise.all(
    Array.from(jobsMap.entries()).map(async ([runId, jobs]) => {
      const activeJob = jobs.find((j) => j.status === 'in_progress') ?? jobs[0];
      if (!activeJob) return;
      const snippet = await fetchJobLogsSnippet(repo, activeJob.id, token);
      logSnippetsMap.set(runId, snippet);
    })
  );

  const agents = buildAgentStatus(
    space.workflow_config, runsData.workflow_runs, openIssues, openPRs, mergedPRs, jobsMap, logSnippetsMap
  );
  const activityFeed = buildActivityFeed(
    runsData.workflow_runs, openPRs, mergedPRs, openIssues
  );

  return NextResponse.json({ agents, activityFeed, fetchedAt: new Date().toISOString() } satisfies SpaceStatusResponse);
}
