import { CronExpressionParser } from 'cron-parser';
import type { AgentStatus, AgentState, AgentJobStep, WorkflowConfig, AgentRoleKey,
              ActivityItem, ActivityItemType } from '@/lib/types';
import { AGENT_ROLES } from '@/config/agent-roles';
import type { GHWorkflowRun, GHIssue, GHPR, GHRunJob } from '@/lib/github';

// Run-id → job/step data, fetched separately for active runs
export type JobsMap = Map<number, GHRunJob[]>;


function getNextCronAt(expression: string): string | null {
  try {
    const interval = CronExpressionParser.parse(expression);
    return interval.next().toISOString();
  } catch {
    return null;
  }
}

export function buildAgentStatus(
  config: WorkflowConfig,
  runs: GHWorkflowRun[],
  openIssues: GHIssue[],
  openPRs: GHPR[],
  mergedPRs: GHPR[],
  jobsMap: JobsMap = new Map(),
  logSnippetsMap: Map<number, string | null> = new Map()
): AgentStatus[] {
  const roles = Object.keys(AGENT_ROLES) as AgentRoleKey[];
  const cutoff = (minutesAgo: number) =>
    new Date(Date.now() - minutesAgo * 60 * 1000);

  return roles.map((role) => {
    const entry = config[role];
    const idleAfter = AGENT_ROLES[role].idleAfterMinutes;

    if (!entry) {
      return {
        role, state: 'idle', workflowFile: null, runId: null, runName: null,
        runUrl: null, startedAt: null, conclusion: null, nextCronAt: null, currentIssue: null,
        currentStep: null, stepCurrent: null, stepTotal: null, jobSteps: [],
        triggeredBy: null, triggeredByBot: false, event: null, logSnippet: null,
      };
    }

    // Find runs for this role's workflow file(s)
    const allFilenames = [entry.filename, ...(entry.additionalFilenames ?? [])];
    const roleRuns = runs
      .filter((r) => allFilenames.some((fn) => r.path.endsWith(fn)))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const activeRun = roleRuns.find((r) => r.status === 'in_progress');
    const queuedRun = roleRuns.find((r) => r.status === 'queued');
    const recentRun = roleRuns.find(
      (r) => r.status === 'completed' && new Date(r.created_at) > cutoff(idleAfter)
    );

    let state: AgentState;
    const targetRun = activeRun ?? queuedRun ?? recentRun;

    if (activeRun) {
      state = 'working';
    } else if (queuedRun) {
      state = 'queued';
    } else if (recentRun?.conclusion === 'success') {
      state = 'success';
    } else if (recentRun?.conclusion === 'failure') {
      state = 'failed';
    } else if (entry.cronExpression) {
      state = 'sleeping';
    } else {
      state = 'idle';
    }

    // ── Step-level detail for active runs ──────────────────────────
    let currentStep: string | null = null;
    let stepCurrent: number | null = null;
    let stepTotal:   number | null = null;
    let jobSteps: AgentJobStep[]   = [];

    if (activeRun && jobsMap.has(activeRun.id)) {
      const jobs = jobsMap.get(activeRun.id)!;
      const activeJob = jobs.find((j) => j.status === 'in_progress') ?? jobs[0];
      if (activeJob) {
        const allSteps   = activeJob.steps;
        const activeStep = allSteps.find((s) => s.status === 'in_progress');
        const doneSteps  = allSteps.filter((s) => s.status === 'completed').length;
        stepTotal        = allSteps.length;
        stepCurrent      = doneSteps + (activeStep ? 1 : 0);
        currentStep      = activeStep?.name ?? activeJob.name;
        jobSteps         = allSteps.map((s) => ({
          name:        s.name,
          status:      s.status as AgentJobStep['status'],
          conclusion:  s.conclusion,
          startedAt:   s.started_at,
          completedAt: s.completed_at,
        }));
      }
    }

    // ── Sub-agent / triggering info ─────────────────────────────────
    const actor          = targetRun?.triggering_actor ?? null;
    const triggeredByBot = actor?.type === 'Bot' ||
                           actor?.login?.includes('[bot]') === true ||
                           targetRun?.event === 'workflow_run';

    const logSnippet = activeRun ? (logSnippetsMap.get(activeRun.id) ?? null) : null;

    return {
      role,
      state,
      workflowFile: entry.filename,
      runId:        targetRun?.id ?? null,
      runName:      targetRun?.name ?? null,
      runUrl:       targetRun?.html_url ?? null,
      startedAt:    targetRun?.run_started_at ?? null,
      conclusion:   targetRun?.conclusion ?? null,
      nextCronAt:   state === 'sleeping' && entry.cronExpression
                      ? getNextCronAt(entry.cronExpression) : null,
      currentIssue: null,
      currentStep,
      stepCurrent,
      stepTotal,
      jobSteps,
      triggeredBy:    actor?.login ?? null,
      triggeredByBot,
      event:          targetRun?.event ?? null,
      logSnippet,
    };
  });
}

export function buildActivityFeed(
  runs: GHWorkflowRun[],
  openPRs: GHPR[],
  mergedPRs: GHPR[],
  openIssues: GHIssue[]
): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const run of runs.filter((r) =>
    r.status === 'completed' &&
    r.conclusion !== 'skipped' &&
    r.conclusion !== 'cancelled'
  ).slice(0, 10)) {
    const type: ActivityItemType = run.conclusion === 'success' ? 'run_success' : 'run_failed';
    items.push({ type, label: run.name, url: run.html_url, timestamp: run.created_at });
  }
  for (const pr of openPRs) {
    items.push({ type: 'pr_opened', label: `#${pr.number} ${pr.title}`,
      url: pr.html_url, timestamp: pr.created_at });
  }
  for (const pr of mergedPRs) {
    items.push({ type: 'pr_merged', label: `#${pr.number} merged`,
      url: pr.html_url, timestamp: pr.merged_at! });
  }
  for (const issue of openIssues) {
    items.push({ type: 'issue_ready', label: `#${issue.number} ${issue.title}`,
      url: issue.html_url, timestamp: issue.created_at });
  }

  return items
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .filter((item, idx, arr) => arr.findIndex((i) => i.url === item.url) === idx)
    .slice(0, 10);
}
