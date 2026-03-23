export type AgentKind = 'agent' | 'workflow';

export interface WorkflowEntry {
  filename: string;
  kind: AgentKind;
  label: string;
  confidence: number;
  signals: string[];
  cronExpression?: string;
  userLabel?: string;
  userKind?: AgentKind;
  hidden?: boolean;
}

export type ClassifiedWorkflow = Omit<WorkflowEntry, 'userLabel' | 'userKind' | 'hidden'>;

/** Old format for lazy migration */
export interface LegacyWorkflowConfigEntry {
  filename: string;
  additionalFilenames?: string[];
  cronExpression?: string;
}
export type LegacyWorkflowConfig = Record<string, LegacyWorkflowConfigEntry | null>;

export type AgentState =
  | 'working' | 'queued' | 'success' | 'failed'
  | 'idle' | 'coffee' | 'sleeping';

export interface AgentJobStep {
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface AgentStatus {
  id: string;
  label: string;
  kind: AgentKind;
  state: AgentState;
  workflowFile: string;
  runId: number | null;
  runName: string | null;
  runUrl: string | null;
  startedAt: string | null;
  conclusion: string | null;
  nextCronAt: string | null;
  currentIssue: string | null;
  currentStep: string | null;
  stepCurrent: number | null;
  stepTotal: number | null;
  jobSteps: AgentJobStep[];
  triggeredBy: string | null;
  triggeredByBot: boolean;
  event: string | null;
  logSnippet: string | null;
}

export type ActivityItemType =
  | 'run_success' | 'run_failed' | 'pr_opened' | 'pr_merged' | 'issue_ready';

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
