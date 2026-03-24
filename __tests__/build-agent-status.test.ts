import { describe, it, expect } from 'vitest';
import { buildAgentStatus, migrateOldConfig } from '@/lib/build-agent-status';
import type { WorkflowEntry } from '@/lib/types';

const entries: WorkflowEntry[] = [
  { filename: 'orchestrator.yml', kind: 'agent', label: 'Orchestrator', confidence: 0.9, signals: [], cronExpression: '0 */2 * * *' },
  { filename: 'claude-implement.yml', kind: 'agent', label: 'Implementer', confidence: 0.9, signals: [] },
  { filename: 'claude.yml', kind: 'agent', label: 'Reviewer', confidence: 0.7, signals: [] },
  { filename: 'ci.yml', kind: 'workflow', label: 'CI', confidence: 0.6, signals: [] },
  { filename: 'hidden.yml', kind: 'workflow', label: 'Hidden', confidence: 0.5, signals: [], hidden: true },
];

const now = new Date();
const recentTime = new Date(now.getTime() - 2 * 60 * 1000).toISOString();
const coffeeTime = new Date(now.getTime() - 90 * 60 * 1000).toISOString();
const staleTime = new Date(now.getTime() - 200 * 60 * 1000).toISOString();

const makeRun = (overrides: Record<string, unknown>) => ({
  id: 1, name: 'Run', path: '', status: 'completed', conclusion: 'success',
  html_url: 'https://github.com/x', created_at: recentTime, run_started_at: recentTime,
  triggering_actor: null, event: 'push', ...overrides,
}) as any;

describe('buildAgentStatus', () => {
  it('marks in_progress run as working', () => {
    const runs = [makeRun({ id: 1, name: 'Implement #42', path: '.github/workflows/claude-implement.yml',
      status: 'in_progress', conclusion: null, event: 'issues' })];
    const statuses = buildAgentStatus(entries, runs, [], [], []);
    const impl = statuses.find(s => s.id === 'claude-implement.yml');
    expect(impl?.state).toBe('working');
    expect(impl?.kind).toBe('agent');
  });

  it('filters out hidden entries', () => {
    const statuses = buildAgentStatus(entries, [], [], [], []);
    expect(statuses.find(s => s.id === 'hidden.yml')).toBeUndefined();
  });

  it('sorts agents first then workflows', () => {
    const statuses = buildAgentStatus(entries, [], [], [], []);
    const kinds = statuses.map(s => s.kind);
    const firstWorkflowIdx = kinds.indexOf('workflow');
    const lastAgentIdx = kinds.lastIndexOf('agent');
    expect(lastAgentIdx).toBeLessThan(firstWorkflowIdx);
  });

  it('computes coffee state for 1-3hr idle', () => {
    const runs = [makeRun({ id: 2, path: '.github/workflows/claude-implement.yml',
      created_at: coffeeTime, run_started_at: coffeeTime, event: 'issues' })];
    const statuses = buildAgentStatus(entries, runs, [], [], []);
    expect(statuses.find(s => s.id === 'claude-implement.yml')?.state).toBe('coffee');
  });

  it('computes sleeping state for >3hr idle', () => {
    const runs = [makeRun({ id: 3, path: '.github/workflows/orchestrator.yml',
      created_at: staleTime, run_started_at: staleTime, event: 'schedule' })];
    const statuses = buildAgentStatus(entries, runs, [], [], []);
    const orch = statuses.find(s => s.id === 'orchestrator.yml');
    expect(orch?.state).toBe('sleeping');
    expect(orch?.nextCronAt).not.toBeNull();
  });

  it('recently completed workflow stays at desk', () => {
    const runs = [makeRun({ id: 4, path: '.github/workflows/ci.yml' })];
    const statuses = buildAgentStatus(entries, runs, [], [], []);
    expect(statuses.find(s => s.id === 'ci.yml')?.state).toBe('success');
  });

  it('resolves user overrides for label and kind', () => {
    const overridden: WorkflowEntry[] = [
      { filename: 'ci.yml', kind: 'workflow', label: 'CI', confidence: 0.6, signals: [],
        userLabel: 'My Custom CI', userKind: 'agent' },
    ];
    const statuses = buildAgentStatus(overridden, [], [], [], []);
    expect(statuses[0].label).toBe('My Custom CI');
    expect(statuses[0].kind).toBe('agent');
  });
});

describe('migrateOldConfig', () => {
  it('converts old role-based config to WorkflowEntry[]', () => {
    const old = {
      orchestrator: { filename: 'orchestrator.yml', cronExpression: '0 */2 * * *' },
      implementer: { filename: 'claude-implement.yml' },
      reviewer: null,
      ci_runner: { filename: 'ci.yml' },
      branch_sync: { filename: 'sync.yml' },
      pipeline: null,
    };
    const result = migrateOldConfig(old);
    expect(result).toHaveLength(4);
    expect(result.find(e => e.filename === 'orchestrator.yml')?.kind).toBe('agent');
    expect(result.find(e => e.filename === 'orchestrator.yml')?.cronExpression).toBe('0 */2 * * *');
    expect(result.find(e => e.filename === 'ci.yml')?.kind).toBe('workflow');
    expect(result.find(e => e.filename === 'sync.yml')?.kind).toBe('workflow');
  });

  it('expands additionalFilenames into separate entries', () => {
    const old = {
      reviewer: { filename: 'claude.yml', additionalFilenames: ['claude-fix.yml'] },
    };
    const result = migrateOldConfig(old);
    expect(result).toHaveLength(2);
    expect(result[1].filename).toBe('claude-fix.yml');
    expect(result[1].label).toContain('(alt)');
  });
});
