import { describe, it, expect } from 'vitest';
import { buildAgentStatus } from '@/lib/build-agent-status';
import type { WorkflowConfig } from '@/lib/types';

const baseConfig: WorkflowConfig = {
  orchestrator: { filename: 'orchestrator.yml', cronExpression: '0 */2 * * *' },
  implementer:  { filename: 'claude-implement.yml' },
  reviewer:     { filename: 'claude.yml' },
  ci_runner:    { filename: 'ci.yml' },
  board_sync:   { filename: 'board-sync.yml' },
  pipeline:     { filename: 'claude-pipeline.yml' },
};

const now = new Date();
const recentTime = new Date(now.getTime() - 5 * 60 * 1000).toISOString(); // 5 min ago
const staleTime = new Date(now.getTime() - 200 * 60 * 1000).toISOString(); // 200 min ago

describe('buildAgentStatus', () => {
  it('marks in_progress run as working', () => {
    const runs = [{ id: 1, name: 'Implement #42', path: '.github/workflows/claude-implement.yml',
      status: 'in_progress', conclusion: null, html_url: 'https://github.com/x',
      created_at: recentTime, run_started_at: recentTime,
      triggering_actor: null, event: 'issues' }];
    const statuses = buildAgentStatus(baseConfig, runs, [], [], []);
    const impl = statuses.find((s) => s.role === 'implementer');
    expect(impl?.state).toBe('working');
    expect(impl?.runName).toBe('Implement #42');
  });

  it('marks cron-workflow with no recent run as sleeping', () => {
    const runs = [{ id: 2, name: 'Orchestrate', path: '.github/workflows/orchestrator.yml',
      status: 'completed', conclusion: 'success', html_url: 'https://github.com/x',
      created_at: staleTime, run_started_at: staleTime,
      triggering_actor: null, event: 'schedule' }];
    const statuses = buildAgentStatus(baseConfig, runs, [], [], []);
    const orch = statuses.find((s) => s.role === 'orchestrator');
    expect(orch?.state).toBe('sleeping');
    expect(orch?.nextCronAt).not.toBeNull();
  });

  it('marks non-cron workflow with no recent run as idle', () => {
    const statuses = buildAgentStatus(baseConfig, [], [], [], []);
    const impl = statuses.find((s) => s.role === 'implementer');
    expect(impl?.state).toBe('idle');
    expect(impl?.nextCronAt).toBeNull();
  });

  it('marks null-mapped role as idle with no workflowFile', () => {
    const config = { ...baseConfig, reviewer: null };
    const statuses = buildAgentStatus(config, [], [], [], []);
    const rev = statuses.find((s) => s.role === 'reviewer');
    expect(rev?.state).toBe('idle');
    expect(rev?.workflowFile).toBeNull();
  });
});
