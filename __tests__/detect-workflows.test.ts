import { describe, it, expect } from 'vitest';
import { classifyWorkflows } from '@/lib/classify-workflows';
import type { WorkflowMeta } from '@/lib/classify-workflows';

describe('classifyWorkflows integration', () => {
  const collabreWorkflows: WorkflowMeta[] = [
    { filename: 'orchestrator.yml', name: 'Orchestrator', triggerTypes: ['schedule'],
      usesActions: ['anthropic/claude-code-action@v1'], referencedSecrets: ['ANTHROPIC_API_KEY'],
      referencedEnvVars: [], cronExpression: '0 */2 * * *' },
    { filename: 'claude-implement.yml', name: 'Claude Implement', triggerTypes: ['issues'],
      usesActions: ['anthropic/claude-code-action@v1'], referencedSecrets: ['ANTHROPIC_API_KEY'],
      referencedEnvVars: [] },
    { filename: 'claude.yml', name: 'Claude Review', triggerTypes: ['issue_comment', 'pull_request_review_comment'],
      usesActions: ['anthropic/claude-code-action@v1'], referencedSecrets: ['ANTHROPIC_API_KEY'],
      referencedEnvVars: [] },
    { filename: 'ci.yml', name: 'CI', triggerTypes: ['push', 'pull_request'],
      usesActions: ['actions/checkout@v4', 'actions/setup-node@v4'], referencedSecrets: [],
      referencedEnvVars: [] },
    { filename: 'sync-main-to-develop.yml', name: 'Sync Main to Develop', triggerTypes: ['push'],
      usesActions: ['actions/checkout@v4'], referencedSecrets: ['GITHUB_TOKEN'],
      referencedEnvVars: [] },
  ];

  it('classifies all collabre workflows correctly', () => {
    const results = classifyWorkflows(collabreWorkflows);
    expect(results).toHaveLength(5);

    const byFile = new Map(results.map(r => [r.filename, r]));
    expect(byFile.get('orchestrator.yml')?.kind).toBe('agent');
    expect(byFile.get('claude-implement.yml')?.kind).toBe('agent');
    expect(byFile.get('claude.yml')?.kind).toBe('agent');
    expect(byFile.get('ci.yml')?.kind).toBe('workflow');
    expect(byFile.get('sync-main-to-develop.yml')?.kind).toBe('workflow');
  });

  it('preserves labels from YAML name field', () => {
    const results = classifyWorkflows(collabreWorkflows);
    const byFile = new Map(results.map(r => [r.filename, r]));
    expect(byFile.get('orchestrator.yml')?.label).toBe('Orchestrator');
    expect(byFile.get('ci.yml')?.label).toBe('CI');
  });

  it('preserves cron expressions', () => {
    const results = classifyWorkflows(collabreWorkflows);
    const orch = results.find(r => r.filename === 'orchestrator.yml');
    expect(orch?.cronExpression).toBe('0 */2 * * *');
  });

  it('all agent classifications from AI actions have high confidence', () => {
    const results = classifyWorkflows(collabreWorkflows);
    // Filter to agents that were classified via AI action signals (not keyword false positives)
    const aiAgents = results.filter(r =>
      r.kind === 'agent' && r.signals.some(s => s.startsWith('uses ai action:'))
    );
    expect(aiAgents.length).toBeGreaterThanOrEqual(3);
    for (const a of aiAgents) {
      expect(a.confidence).toBeGreaterThanOrEqual(0.9);
    }
  });
});
