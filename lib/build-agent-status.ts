import { CronExpressionParser } from 'cron-parser';
import type { WorkflowEntry, AgentStatus, AgentState, AgentJobStep, AgentKind,
              ActivityItem, ActivityItemType } from '@/lib/types';
import type { GHWorkflowRun, GHIssue, GHPR, GHRunJob } from '@/lib/github';

// Run-id → job/step data, fetched separately for active runs
export type JobsMap = Map<number, GHRunJob[]>;

const AGENT_DESK_GRACE = 15;    // minutes
const WORKFLOW_DESK_GRACE = 5;
const COFFEE_AFTER_MIN = 60;    // 1 hour idle → coffee
const SLEEP_AFTER_MIN  = 180;   // 3 hours idle → sleeping

function getNextCronAt(expression: string): string | null {
  try {
    const interval = CronExpressionParser.parse(expression);
    return interval.next().toISOString();
  } catch {
    return null;
  }
}

/** Determine the idle sub-state based on minutes since last completed run */
function idleSubState(minutesSinceRun: number): AgentState {
  if (minutesSinceRun >= SLEEP_AFTER_MIN) return 'sleeping';
  if (minutesSinceRun >= COFFEE_AFTER_MIN) return 'coffee';
  return 'idle';
}

export function buildAgentStatus(
  entries: WorkflowEntry[],
  runs: GHWorkflowRun[],
  openIssues: GHIssue[],
  openPRs: GHPR[],
  mergedPRs: GHPR[],
  jobsMap: JobsMap = new Map(),
  logSnippetsMap: Map<number, string | null> = new Map()
): AgentStatus[] {
  const now = Date.now();

  const visible = entries.filter(e => !e.hidden);

  const statuses: AgentStatus[] = visible.map((entry) => {
    const kind: AgentKind = entry.userKind ?? entry.kind;
    const label = entry.userLabel ?? entry.label;
    const deskGrace = kind === 'agent' ? AGENT_DESK_GRACE : WORKFLOW_DESK_GRACE;

    // Find runs for this entry's workflow file
    const entryRuns = runs
      .filter((r) => r.path.endsWith(entry.filename))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const activeRun = entryRuns.find((r) => r.status === 'in_progress');
    const queuedRun = entryRuns.find((r) => r.status === 'queued');
    const latestCompleted = entryRuns.find((r) => r.status === 'completed');

    let state: AgentState;
    const targetRun = activeRun ?? queuedRun ?? latestCompleted;

    if (activeRun) {
      state = 'working';
    } else if (queuedRun) {
      state = 'queued';
    } else if (latestCompleted) {
      const minutesSince = (now - new Date(latestCompleted.created_at).getTime()) / 60_000;
      if (minutesSince < deskGrace) {
        state = latestCompleted.conclusion === 'success' ? 'success' : 'failed';
      } else {
        state = idleSubState(minutesSince);
      }
    } else {
      state = 'sleeping';
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

    // ── Triggering info ─────────────────────────────────────────────
    const actor          = targetRun?.triggering_actor ?? null;
    const triggeredByBot = actor?.type === 'Bot' ||
                           actor?.login?.includes('[bot]') === true ||
                           targetRun?.event === 'workflow_run';

    const logSnippet = activeRun ? (logSnippetsMap.get(activeRun.id) ?? null) : null;

    return {
      id: entry.filename,
      label,
      kind,
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

  // Sort: agents first (alphabetically by filename), then workflows (alphabetically)
  statuses.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === 'agent' ? -1 : 1;
    }
    return a.id.localeCompare(b.id);
  });

  return statuses;
}

// ── Legacy config migration ─────────────────────────────────────────

const LEGACY_ROLE_KIND: Record<string, 'agent' | 'workflow'> = {
  orchestrator: 'agent', implementer: 'agent', reviewer: 'agent', pipeline: 'agent',
  ci_runner: 'workflow', board_sync: 'workflow', branch_sync: 'workflow',
};
const LEGACY_ROLE_LABEL: Record<string, string> = {
  orchestrator: 'Orchestrator', implementer: 'Implementer', reviewer: 'Reviewer',
  ci_runner: 'CI Runner', board_sync: 'Board Sync', branch_sync: 'Branch Sync',
  pipeline: 'Pipeline',
};

export function migrateOldConfig(config: Record<string, any>): WorkflowEntry[] {
  const entries: WorkflowEntry[] = [];
  for (const [role, entry] of Object.entries(config)) {
    if (!entry || !entry.filename) continue;
    const kind = LEGACY_ROLE_KIND[role] ?? 'workflow';
    const label = LEGACY_ROLE_LABEL[role] ?? role;
    entries.push({
      filename: entry.filename, kind, label,
      confidence: 0.5, signals: ['migrated from legacy config'],
      ...(entry.cronExpression ? { cronExpression: entry.cronExpression } : {}),
    });
    if (entry.additionalFilenames) {
      for (const fn of entry.additionalFilenames) {
        entries.push({
          filename: fn, kind, label: `${label} (alt)`,
          confidence: 0.5, signals: ['migrated from legacy config'],
        });
      }
    }
  }
  return entries;
}

// ── Activity feed (unchanged) ───────────────────────────────────────

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
