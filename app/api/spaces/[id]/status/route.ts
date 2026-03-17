import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, spaces } from '@/lib/db/schema';
import { decrypt } from '@/lib/encrypt';
import { fetchWorkflowRuns, fetchOpenIssues, fetchOpenPRs, fetchRecentlyMergedPRs } from '@/lib/github';
import { buildAgentStatus, buildActivityFeed } from '@/lib/build-agent-status';
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

  const agents = buildAgentStatus(
    space.workflow_config, runsData.workflow_runs, openIssues, openPRs, mergedPRs
  );
  const activityFeed = buildActivityFeed(
    runsData.workflow_runs, openPRs, mergedPRs, openIssues
  );

  return NextResponse.json({ agents, activityFeed, fetchedAt: new Date().toISOString() } satisfies SpaceStatusResponse);
}
