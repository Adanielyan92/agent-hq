import type { AgentRoleConfig } from '@/lib/types';

export const AGENT_ROLES = {
  orchestrator: {
    label: 'Orchestrator',
    description: 'Monitors board & creates tasks',
    sprite: 'manager',
    color: 'violet',
    idleAfterMinutes: 130,
    autoDetect: {
      filenamePatterns: ['orchestrat*', 'scheduler*', 'monitor*', 'board*'],
      triggerTypes: ['schedule'],
      nameKeywords: ['orchestrat', 'monitor', 'board', 'plan'],
    },
  },
  implementer: {
    label: 'Implementer',
    description: 'Picks up issues and writes code',
    sprite: 'developer',
    color: 'blue',
    idleAfterMinutes: 60,
    autoDetect: {
      filenamePatterns: ['implement*', 'claude-implement*', 'feature*', 'develop*'],
      triggerTypes: ['issues'],
      nameKeywords: ['implement', 'build', 'develop', 'code'],
    },
  },
  reviewer: {
    label: 'Reviewer',
    description: 'Reviews PRs and approves merges',
    sprite: 'reviewer',
    color: 'amber',
    idleAfterMinutes: 60,
    autoDetect: {
      filenamePatterns: ['review*', 'claude-review*', 'check*'],
      triggerTypes: ['pull_request_review_comment', 'issue_comment'],
      nameKeywords: ['review', 'check', 'inspect', 'audit'],
    },
  },
  ci_runner: {
    label: 'CI Runner',
    description: 'Runs lint, build, and tests',
    sprite: 'builder',
    color: 'green',
    idleAfterMinutes: 30,
    autoDetect: {
      filenamePatterns: ['ci*', 'test*', 'build*', 'lint*'],
      triggerTypes: ['push', 'pull_request'],
      nameKeywords: ['ci', 'test', 'build', 'lint', 'check'],
    },
  },
  board_sync: {
    label: 'Board Sync',
    description: 'Keeps project board in sync',
    sprite: 'scribe',
    color: 'slate',
    idleAfterMinutes: 10,
    autoDetect: {
      filenamePatterns: ['board*', 'sync*', 'project*'],
      triggerTypes: ['issues', 'pull_request'],
      nameKeywords: ['board', 'sync', 'project', 'label'],
    },
  },
  pipeline: {
    label: 'Pipeline',
    description: 'Full autonomous implement-review-merge loop',
    sprite: 'manager',
    color: 'rose',
    idleAfterMinutes: 60,
    autoDetect: {
      filenamePatterns: ['pipeline*', 'claude-pipeline*', 'auto*'],
      triggerTypes: ['workflow_dispatch'],
      nameKeywords: ['pipeline', 'full', 'auto', 'complete'],
    },
  },
} satisfies Record<string, AgentRoleConfig>;
