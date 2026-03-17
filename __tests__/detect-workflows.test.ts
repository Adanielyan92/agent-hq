import { describe, it, expect } from 'vitest';
import { scoreWorkflow, detectWorkflows } from '@/lib/detect-workflows';
import { AGENT_ROLES } from '@/config/agent-roles';

describe('scoreWorkflow', () => {
  it('scores orchestrator.yml as orchestrator with high confidence', () => {
    const score = scoreWorkflow(
      { filename: 'orchestrator', triggerTypes: ['schedule'], name: 'Orchestrator' },
      AGENT_ROLES.orchestrator.autoDetect
    );
    expect(score).toBeGreaterThanOrEqual(4);
  });

  it('scores ci.yml as ci_runner', () => {
    const score = scoreWorkflow(
      { filename: 'ci', triggerTypes: ['push', 'pull_request'], name: 'CI' },
      AGENT_ROLES.ci_runner.autoDetect
    );
    expect(score).toBeGreaterThanOrEqual(4);
  });

  it('scores unrelated workflow low', () => {
    const score = scoreWorkflow(
      { filename: 'dependabot', triggerTypes: ['schedule'], name: 'Dependabot' },
      AGENT_ROLES.implementer.autoDetect
    );
    expect(score).toBeLessThan(3);
  });
});

describe('detectWorkflows', () => {
  const mockWorkflows = [
    { filename: 'orchestrator', triggerTypes: ['schedule'], name: 'Orchestrator', cronExpression: '0 */2 * * *' },
    { filename: 'claude-implement', triggerTypes: ['issues'], name: 'Implement' },
    { filename: 'claude', triggerTypes: ['issue_comment'], name: 'Claude' },
    { filename: 'ci', triggerTypes: ['push', 'pull_request'], name: 'CI' },
    { filename: 'board-sync', triggerTypes: ['issues', 'pull_request'], name: 'Board Sync' },
    { filename: 'claude-pipeline', triggerTypes: ['workflow_dispatch'], name: 'Pipeline' },
  ];

  it('detects all 6 roles for the collabre-v2 workflow set', () => {
    const results = detectWorkflows(mockWorkflows);
    const detected = results.filter((r) => r.matched !== null);
    expect(detected).toHaveLength(6);
  });

  it('marks orchestrator as confident', () => {
    const results = detectWorkflows(mockWorkflows);
    const orch = results.find((r) => r.role === 'orchestrator');
    expect(orch?.confidence).toBe('confident');
  });

  it('stores cronExpression for orchestrator', () => {
    const results = detectWorkflows(mockWorkflows);
    const orch = results.find((r) => r.role === 'orchestrator');
    expect(orch?.matched?.cronExpression).toBe('0 */2 * * *');
  });
});
