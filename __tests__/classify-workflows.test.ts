import { describe, it, expect } from 'vitest';
import { classifyWorkflows } from '@/lib/classify-workflows';
import type { WorkflowMeta } from '@/lib/classify-workflows';

describe('classifyWorkflows', () => {
  it('classifies workflow using claude-code-action as agent with high confidence', () => {
    const wfs: WorkflowMeta[] = [{
      filename: 'claude-implement.yml',
      name: 'Implement',
      triggerTypes: ['issues'],
      usesActions: ['anthropic/claude-code-action@v1'],
      referencedSecrets: ['ANTHROPIC_API_KEY'],
      referencedEnvVars: [],
    }];
    const results = classifyWorkflows(wfs);
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('agent');
    expect(results[0].confidence).toBeGreaterThanOrEqual(0.9);
    expect(results[0].signals).toContain('uses ai action: anthropic/claude-code-action@v1');
  });

  it('classifies ci.yml with push trigger as workflow', () => {
    const wfs: WorkflowMeta[] = [{
      filename: 'ci.yml',
      name: 'CI',
      triggerTypes: ['push', 'pull_request'],
      usesActions: ['actions/checkout@v4', 'actions/setup-node@v4'],
      referencedSecrets: [],
      referencedEnvVars: [],
    }];
    const results = classifyWorkflows(wfs);
    expect(results[0].kind).toBe('workflow');
    expect(results[0].confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('classifies schedule-triggered workflow with AI secret as agent', () => {
    const wfs: WorkflowMeta[] = [{
      filename: 'orchestrator.yml',
      name: 'Orchestrator',
      triggerTypes: ['schedule'],
      usesActions: ['anthropic/claude-code-action@v1'],
      referencedSecrets: ['ANTHROPIC_API_KEY'],
      referencedEnvVars: [],
      cronExpression: '0 */2 * * *',
    }];
    const results = classifyWorkflows(wfs);
    expect(results[0].kind).toBe('agent');
    expect(results[0].cronExpression).toBe('0 */2 * * *');
  });

  it('defaults unrecognized workflow to workflow with low confidence', () => {
    const wfs: WorkflowMeta[] = [{
      filename: 'something-random.yml',
      name: 'Random',
      triggerTypes: ['workflow_dispatch'],
      usesActions: [],
      referencedSecrets: [],
      referencedEnvVars: [],
    }];
    const results = classifyWorkflows(wfs);
    expect(results[0].kind).toBe('workflow');
    expect(results[0].confidence).toBeLessThanOrEqual(0.3);
  });

  it('agent wins on tie between AI and CI keywords', () => {
    const wfs: WorkflowMeta[] = [{
      filename: 'ci-claude-review.yml',
      name: 'CI Claude Review',
      triggerTypes: ['pull_request'],
      usesActions: [],
      referencedSecrets: [],
      referencedEnvVars: [],
    }];
    const results = classifyWorkflows(wfs);
    expect(results[0].kind).toBe('agent');
  });

  it('generates label from YAML name field', () => {
    const wfs: WorkflowMeta[] = [{
      filename: 'ci.yml',
      name: 'Build & Test',
      triggerTypes: ['push'],
      usesActions: [],
      referencedSecrets: [],
      referencedEnvVars: [],
    }];
    const results = classifyWorkflows(wfs);
    expect(results[0].label).toBe('Build & Test');
  });

  it('generates label from filename when YAML name is missing', () => {
    const wfs: WorkflowMeta[] = [{
      filename: 'sync-main-to-develop.yml',
      name: 'sync-main-to-develop.yml',
      triggerTypes: ['push'],
      usesActions: [],
      referencedSecrets: [],
      referencedEnvVars: [],
    }];
    const results = classifyWorkflows(wfs);
    expect(results[0].label).toBe('Sync Main To Develop');
  });
});
