import type { AGENT_ROLES } from '@/config/agent-roles';

export type AgentRoleKey = keyof typeof AGENT_ROLES;

export interface AgentRoleConfig {
  label: string;
  description: string;
  sprite: string;
  color: string;
  idleAfterMinutes: number;
  autoDetect: {
    filenamePatterns: string[];
    triggerTypes: string[];
    nameKeywords: string[];
  };
}

export interface WorkflowConfigEntry {
  filename: string;
  cronExpression?: string;
}

export type WorkflowConfig = Record<AgentRoleKey, WorkflowConfigEntry | null>;

export interface DetectionResult {
  role: AgentRoleKey;
  matched: WorkflowConfigEntry | null;
  confidence: 'confident' | 'low' | 'undetected';
  score: number;
  alternatives: WorkflowConfigEntry[];
}

export type AgentState =
  | 'working'
  | 'queued'
  | 'success'
  | 'failed'
  | 'idle'
  | 'sleeping';

export interface AgentStatus {
  role: AgentRoleKey;
  state: AgentState;
  workflowFile: string | null;
  runId: number | null;
  runName: string | null;
  runUrl: string | null;
  startedAt: string | null;
  conclusion: string | null;
  nextCronAt: string | null;
  currentIssue: string | null;
  // Step-level detail (populated for working agents)
  currentStep: string | null;       // e.g. "Run Claude agent"
  stepCurrent: number | null;       // e.g. 3
  stepTotal: number | null;         // e.g. 8
  // Sub-agent / triggering info
  triggeredBy: string | null;       // login of triggering actor, or null if human/schedule
  triggeredByBot: boolean;          // true if triggered by another workflow/bot
  event: string | null;             // GitHub event that triggered run
  // Live log output (last ~10 lines, stripped of timestamps)
  logSnippet: string | null;
}

export type ActivityItemType =
  | 'run_success'
  | 'run_failed'
  | 'pr_opened'
  | 'pr_merged'
  | 'issue_ready';

export interface ActivityItem {
  type: ActivityItemType;
  label: string;
  url: string;
  timestamp: string;
}

export interface SpaceStatusResponse {
  agents: AgentStatus[];
  activityFeed: ActivityItem[];
  fetchedAt: string;
}
