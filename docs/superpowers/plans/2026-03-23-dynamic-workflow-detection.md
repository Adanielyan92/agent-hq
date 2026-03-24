# Dynamic Workflow Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded 6-role detection system with a dynamic classifier that works for any GitHub Actions repo.

**Architecture:** The classifier analyzes each workflow YAML independently (actions used, secrets referenced, keywords in name) to determine agent vs workflow kind. The data model changes from a fixed Record to a dynamic array. The game engine creates characters dynamically based on the array length. A settings page allows user overrides.

**Tech Stack:** Next.js App Router, Drizzle ORM (Postgres jsonb), TypeScript, vitest, existing game engine (canvas 2D)

**Spec:** `docs/superpowers/specs/2026-03-23-dynamic-workflow-detection-design.md`

---

### Task 1: New Types & Classifier

**Files:**
- Modify: `lib/types.ts`
- Create: `lib/classify-workflows.ts`
- Create: `__tests__/classify-workflows.test.ts`

- [ ] **Step 1: Write failing tests for the classifier**

```typescript
// __tests__/classify-workflows.test.ts
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
      name: 'sync-main-to-develop.yml',  // fallback = filename
      triggerTypes: ['push'],
      usesActions: [],
      referencedSecrets: [],
      referencedEnvVars: [],
    }];
    const results = classifyWorkflows(wfs);
    expect(results[0].label).toBe('Sync Main To Develop');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/classify-workflows.test.ts`
Expected: FAIL — module `@/lib/classify-workflows` not found

- [ ] **Step 3: Update types**

Replace the contents of `lib/types.ts` with the new type definitions. Remove `AgentRoleKey`, `AgentRoleConfig`, `WorkflowConfigEntry`, `WorkflowConfig`, `DetectionResult`. Add `WorkflowEntry`, `ClassifiedWorkflow`, new `AgentStatus`. Keep `AgentKind`, `AgentState`, `AgentJobStep`, `ActivityItem`, `ActivityItemType`, `SpaceStatusResponse` (unchanged shape).

```typescript
// lib/types.ts
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
```

- [ ] **Step 4: Write the classifier**

```typescript
// lib/classify-workflows.ts
import type { ClassifiedWorkflow } from '@/lib/types';

export interface WorkflowMeta {
  filename: string;
  name: string;
  triggerTypes: string[];
  cronExpression?: string;
  usesActions: string[];
  referencedSecrets: string[];
  referencedEnvVars: string[];
}

const AI_ACTION_PATTERNS = [
  'anthropic/claude-code-action',
  'github/copilot-',
  'coderabbitai/',
];

const AI_SECRET_PATTERNS = [
  'ANTHROPIC_API_KEY', 'OPENAI_API_KEY',
  /^CLAUDE_/i, /^AI_/i,
];

const AI_KEYWORDS = ['claude', 'copilot', 'agent', 'ai', 'gpt', 'llm', 'anthropic', 'openai'];
const CI_KEYWORDS = ['ci', 'test', 'build', 'lint', 'deploy', 'release', 'sync', 'merge', 'check', 'publish'];

interface Signal {
  kind: 'agent' | 'workflow';
  confidence: number;
  reason: string;
}

function collectSignals(wf: WorkflowMeta): Signal[] {
  const signals: Signal[] = [];
  const lowerName = `${wf.name} ${wf.filename}`.toLowerCase();

  // Priority 1: known AI actions
  for (const action of wf.usesActions) {
    if (AI_ACTION_PATTERNS.some(p => action.toLowerCase().startsWith(p.toLowerCase()))) {
      signals.push({ kind: 'agent', confidence: 0.9, reason: `uses ai action: ${action}` });
    }
  }

  // Priority 2: AI secrets/env vars
  const allRefs = [...wf.referencedSecrets, ...wf.referencedEnvVars];
  for (const ref of allRefs) {
    const matches = AI_SECRET_PATTERNS.some(p =>
      typeof p === 'string' ? ref === p : p.test(ref)
    );
    if (matches) {
      signals.push({ kind: 'agent', confidence: 0.7, reason: `references ai secret: ${ref}` });
    }
  }

  // Priority 3: AI keywords in name/filename
  for (const kw of AI_KEYWORDS) {
    if (lowerName.includes(kw)) {
      signals.push({ kind: 'agent', confidence: 0.6, reason: `name contains ai keyword: ${kw}` });
      break; // one keyword match is enough
    }
  }

  // Priority 4: CI keywords in name/filename
  for (const kw of CI_KEYWORDS) {
    if (lowerName.includes(kw)) {
      signals.push({ kind: 'workflow', confidence: 0.6, reason: `name contains ci keyword: ${kw}` });
      break;
    }
  }

  // Priority 5: trigger type heuristic (fallback)
  if (signals.length === 0) {
    const triggers = wf.triggerTypes;
    if (triggers.includes('issues') || triggers.includes('issue_comment')) {
      signals.push({ kind: 'agent', confidence: 0.3, reason: 'trigger: issues/issue_comment' });
    } else if (triggers.includes('push') || triggers.includes('pull_request')) {
      signals.push({ kind: 'workflow', confidence: 0.3, reason: 'trigger: push/pull_request' });
    }
  }

  return signals;
}

function cleanLabel(filename: string): string {
  return filename
    .replace(/\.(yml|yaml)$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function classifyWorkflows(workflows: WorkflowMeta[]): ClassifiedWorkflow[] {
  return workflows.map(wf => {
    const signals = collectSignals(wf);

    // Resolve: highest confidence wins, agent wins ties
    let bestKind: 'agent' | 'workflow' = 'workflow';
    let bestConfidence = 0.2;

    for (const s of signals) {
      if (s.confidence > bestConfidence || (s.confidence === bestConfidence && s.kind === 'agent')) {
        bestKind = s.kind;
        bestConfidence = s.confidence;
      }
    }

    // Label: use YAML name, fall back to cleaned filename
    const isFilenameFallback = wf.name === wf.filename || wf.name === '';
    const label = isFilenameFallback ? cleanLabel(wf.filename) : wf.name;

    return {
      filename: wf.filename,
      kind: bestKind,
      label,
      confidence: bestConfidence,
      signals: signals.map(s => s.reason),
      ...(wf.cronExpression ? { cronExpression: wf.cronExpression } : {}),
    };
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run __tests__/classify-workflows.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/classify-workflows.ts __tests__/classify-workflows.test.ts
git commit -m "feat: add dynamic workflow classifier replacing hardcoded roles"
```

---

### Task 2: Update Build Agent Status

**Files:**
- Modify: `lib/build-agent-status.ts`
- Modify: `__tests__/build-agent-status.test.ts`

**Important:** The new `buildAgentStatus` signature is `(entries: WorkflowEntry[], runs, openIssues, openPRs, mergedPRs, jobsMap?, logSnippetsMap?)` — same as before except the first param changes from `WorkflowConfig` to `WorkflowEntry[]`. The `buildActivityFeed` export must be preserved unchanged. The `migrateOldConfig` helper is also exported from this file.

- [ ] **Step 1: Rewrite tests for new interface**

The function now takes `WorkflowEntry[]` instead of `WorkflowConfig`. Run objects need `as any` casts since we use minimal fixtures. Update `__tests__/build-agent-status.test.ts`:

```typescript
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

// Minimal run fixtures — use `as any` since we only need the fields buildAgentStatus reads
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
    expect(result).toHaveLength(4); // 2 nulls excluded
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/build-agent-status.test.ts`
Expected: FAIL — function signature mismatch

- [ ] **Step 3: Rewrite buildAgentStatus**

Rewrite `lib/build-agent-status.ts` to accept `WorkflowEntry[]` instead of `WorkflowConfig`. Add `migrateOldConfig()` helper. Remove all `AGENT_ROLES` imports. Key changes:
- First parameter: `entries: WorkflowEntry[]` (filter out `hidden`)
- Use `AGENT_DESK_GRACE = 15` and `WORKFLOW_DESK_GRACE = 5` constants
- Sort output: agents first (alphabetical by filename), then workflows (alphabetical)
- `id` = `entry.filename`, `label` = `entry.userLabel ?? entry.label`, `kind` = `entry.userKind ?? entry.kind`
- `workflowFile` = `entry.filename`
- Run matching: `runs.filter(r => r.path.endsWith(entry.filename))`

Also add `migrateOldConfig` function with the legacy role → kind mapping hardcoded.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/build-agent-status.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/build-agent-status.ts __tests__/build-agent-status.test.ts
git commit -m "feat: rewrite buildAgentStatus for dynamic WorkflowEntry[] input"
```

---

### Task 3: Update Detect API Route

**Files:**
- Modify: `app/api/detect/route.ts`
- Modify: `__tests__/detect-workflows.test.ts`

**Note:** Do NOT delete `lib/detect-workflows.ts` or `config/agent-roles.ts` yet — `app/api/spaces/[id]/route.ts` still imports them. They're deleted in Task 11 after all consumers are updated.

- [ ] **Step 1: Rewrite detect API route**

Update `app/api/detect/route.ts` to:
- Import `classifyWorkflows` from `@/lib/classify-workflows` (not `detectWorkflows`)
- Remove `detectWorkflows` import
- Keep filename WITH extension: use `f.name` directly, NOT `f.name.replace(/\.(yml|yaml)$/, '')`
- Extract `usesActions` by walking `parsed.jobs.*.steps[].uses`
- Extract `referencedSecrets` by scanning for `${{ secrets.* }}` patterns in the raw YAML string
- Extract `referencedEnvVars` by walking `parsed.jobs.*.env` and `parsed.jobs.*.steps[].env`
- Wrap each file's YAML parsing in try/catch — on failure, include file with `kind: 'workflow'`, `confidence: 0.1`, `signals: ['yaml parse error']`
- Return `ClassifiedWorkflow[]` directly (flat array)

- [ ] **Step 2: Rewrite detect tests**

Update `__tests__/detect-workflows.test.ts` to test `classifyWorkflows` directly (the old `scoreWorkflow` / `detectWorkflows` exports are gone). Test the classification of a realistic set of workflows similar to collabre.

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add app/api/detect/route.ts __tests__/detect-workflows.test.ts
git commit -m "feat: rewrite detect API to use dynamic classifier"
```

---

### Task 4: Update DB Schema & Status Route (with migration)

**Files:**
- Modify: `lib/db/schema.ts`
- Modify: `app/api/spaces/[id]/status/route.ts`

- [ ] **Step 1: Update schema type annotation**

In `lib/db/schema.ts`, change the `workflow_config` column type:

```typescript
import type { WorkflowEntry, LegacyWorkflowConfig } from '@/lib/types';

// In spaces table:
workflow_config: jsonb('workflow_config')
                   .notNull()
                   .$type<WorkflowEntry[] | LegacyWorkflowConfig>(),
```

- [ ] **Step 2: Update status route with lazy migration**

In `app/api/spaces/[id]/status/route.ts`:
- Import `migrateOldConfig` from `@/lib/build-agent-status`
- After fetching the space, check if `workflow_config` is an array
- If not (old format): call `migrateOldConfig()`, write back to DB, use the migrated array
- Pass the `WorkflowEntry[]` to `buildAgentStatus` (new signature)

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: May still have errors from UI components — those come next.

- [ ] **Step 4: Commit**

```bash
git add lib/db/schema.ts app/api/spaces/[id]/status/route.ts
git commit -m "feat: add lazy migration for old workflow config format"
```

---

### Task 5: Update Space PATCH Route & New Space Page

**Files:**
- Modify: `app/api/spaces/[id]/route.ts`
- Modify: `app/api/spaces/route.ts` (POST — create space)
- Modify: `app/dashboard/spaces/new/page.tsx`

- [ ] **Step 1: Update PATCH route**

In `app/api/spaces/[id]/route.ts`:
- **Remove all old imports:** `fetchWorkflowFiles`, `fetchFileContent`, `detectWorkflows`, `parseYaml`, `WorkflowConfig` — these are no longer needed since the PATCH route no longer re-detects.
- The PATCH handler should accept `workflow_config: WorkflowEntry[]` directly from the request body (settings page will send the full array). Remove the re-detect-on-PATCH logic — re-detection is now triggered from the settings page client-side, and the PATCH just saves whatever the client sends.

```typescript
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.workflow_config) updates.workflow_config = body.workflow_config;
  if (body.share_enabled !== undefined) updates.share_enabled = body.share_enabled;

  const [updated] = await db
    .update(spaces)
    .set(updates)
    .where(and(eq(spaces.id, id), eq(spaces.owner_id, session.user.id)))
    .returning();

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}
```

- [ ] **Step 2: Update new space page**

In `app/dashboard/spaces/new/page.tsx`:
- Change `results` type from `DetectionResult[] | null` to `ClassifiedWorkflow[] | null`
- Build `workflow_config` as `ClassifiedWorkflow[]` directly (it already IS the `WorkflowEntry[]` without overrides)
- Remove `WorkflowConfig` import (type is gone)

- [ ] **Step 3: Update WorkflowDetector component**

In `components/spaces/WorkflowDetector.tsx`:
- Accept `results: ClassifiedWorkflow[]` instead of `DetectionResult[]`
- Remove AGENT_ROLES import
- Show each workflow's `label`, `kind` badge, `confidence`, and `filename`
- No longer show role names — show the auto-detected label

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Closer to clean — remaining errors will be in game engine / office components.

- [ ] **Step 5: Commit**

```bash
git add app/api/spaces/[id]/route.ts app/api/spaces/route.ts app/dashboard/spaces/new/page.tsx components/spaces/WorkflowDetector.tsx
git commit -m "feat: update space creation & detection UI for dynamic workflows"
```

---

### Task 6: Add colorForWorkflow Utility

**Files:**
- Create: `lib/workflow-colors.ts`

- [ ] **Step 1: Create the utility**

```typescript
// lib/workflow-colors.ts
const PALETTE = [
  '#a78bfa', '#60a5fa', '#fbbf24', '#34d399',
  '#94a3b8', '#f472b6', '#fb923c', '#22d3ee',
];

export function colorForWorkflow(filename: string): string {
  let hash = 0;
  for (const ch of filename) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/workflow-colors.ts
git commit -m "feat: add deterministic color assignment for workflows"
```

---

### Task 7: Update Office UI Components

**Files:**
- Modify: `components/office/OfficeFloor.tsx`
- Modify: `components/office/AgentDesk.tsx`
- Modify: `components/office/LogFeed.tsx`

- [ ] **Step 1: Update OfficeFloor**

- Remove hardcoded role references
- The roster strip already iterates `agents.map(...)` — change from `a.role.replace('_', '\u00A0')` to `a.label`
- Add kind indicator (small badge) in roster

- [ ] **Step 2: Update AgentDesk**

- Replace `ROLE_COLORS` map with `colorForWorkflow(agent.workflowFile)`
- Replace `AGENT_ROLES[agent.role]` lookups with `agent.label` and `agent.kind`
- Remove `AgentRoleKey` import
- `MONITOR_CONFIGS` and `STATE_LABELS` stay the same (keyed by state, not role)

- [ ] **Step 3: Update LogFeed**

- Replace `ROLE_COLORS` map with `colorForWorkflow(agent.workflowFile)`
- Replace `AGENT_ROLES[agent.role]?.label` with `agent.label`
- Key panels by `agent.id` instead of `agent.role`

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add components/office/OfficeFloor.tsx components/office/AgentDesk.tsx components/office/LogFeed.tsx
git commit -m "feat: update office UI for dynamic workflow agents"
```

---

### Task 8: Update Game Engine for Dynamic Agents

**Files:**
- Modify: `components/office/GameCanvas.tsx`
- Modify: `lib/game-engine/officeState.ts`
- Modify: `lib/game-engine/agentHqLayout.ts`
- Modify: `lib/game-engine/renderer.ts`

- [ ] **Step 1: Add removeAgent to OfficeState**

In `lib/game-engine/officeState.ts`, add:

```typescript
removeAgent(id: number): void {
  const ch = this.characters.get(id);
  if (!ch) return;
  if (ch.seatId) {
    const seat = this.seats.get(ch.seatId);
    if (seat) seat.assigned = false;
  }
  this.characters.delete(id);
}
```

- [ ] **Step 2: Remove AGENT_SEAT_INDEX from agentHqLayout**

In `lib/game-engine/agentHqLayout.ts`, delete the `AGENT_SEAT_INDEX` export and its comment block. The rest of the layout stays the same.

- [ ] **Step 3: Remove orchestrator special-casing from renderer**

In `lib/game-engine/renderer.ts`, remove the `ORCH_SCALE` constant and all `ch.roleName === 'orchestrator'` checks. All characters render at the same scale.

- [ ] **Step 4: Rewrite GameCanvas for dynamic agents**

Replace the hardcoded `ROLES` array with dynamic agent management:

- Use a `Map<string, number>` ref to track `agentId (filename) → characterIndex`
- On each status sync: compare incoming agent IDs vs existing map
  - New agents: `state.addAgent(nextIndex, nextIndex % 6, agent.label)` and add to map
  - Removed agents: `state.removeAgent(index)` and remove from map
  - Existing agents: update active/lounge state as before
- Use `agent.id` as the stable key instead of role index
- Remove the `LoungeMode` import from `@/lib/game-engine/types` — it's already imported in the game engine

- [ ] **Step 5: Run TypeScript check + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: Clean

- [ ] **Step 6: Commit**

```bash
git add components/office/GameCanvas.tsx lib/game-engine/officeState.ts lib/game-engine/agentHqLayout.ts lib/game-engine/renderer.ts
git commit -m "feat: dynamic agent management in game engine"
```

---

### Task 9: Settings Page

**Files:**
- Create: `app/spaces/[id]/settings/page.tsx`
- Modify: `app/spaces/[id]/page.tsx` (add settings link)

- [ ] **Step 1: Create settings page**

Server component that fetches the space, renders a client component for the workflow editor. Features:
- List all `WorkflowEntry[]` from the space's `workflow_config`
- Per entry: editable label input, kind toggle (agent/workflow pill), visibility toggle (eye icon), confidence tooltip
- "Re-detect" button: calls `POST /api/detect` with repo name, merges client-side per spec rules
- "Save" button: calls `PATCH /api/spaces/[id]` with the updated array
- Back link to the space page

- [ ] **Step 2: Add settings link to space page**

In `app/spaces/[id]/page.tsx`, add a gear icon link next to the share toggle:

```tsx
<Link href={`/spaces/${space.id}/settings`} className="...">
  <SettingsIcon className="size-4" />
</Link>
```

- [ ] **Step 3: Test manually**

Navigate to a space → click settings → verify workflow list shows. Edit a label, toggle kind, save. Verify changes persist on reload.

- [ ] **Step 4: Commit**

```bash
git add app/spaces/[id]/settings/page.tsx app/spaces/[id]/page.tsx
git commit -m "feat: add space settings page for workflow overrides"
```

---

### Task 10: Large Office Layout

**Files:**
- Create: `lib/game-engine/agentHqLayoutLarge.ts`
- Modify: `components/office/GameCanvas.tsx` (layout selection)

- [ ] **Step 1: Create large layout**

Follow the same pattern as `agentHqLayout.ts` but with a wider room (e.g., 30 cols × 18 rows) and 5 desks per wing (10 total). Same hallway + lounge structure. Export `createAgentHqLayoutLarge()` and a `LOUNGE_TILES_LARGE` constant.

- [ ] **Step 2: Add layout selection to GameCanvas**

In the mount `useEffect`, after getting the initial agent count:

```typescript
const layout = agents.length > 6
  ? createAgentHqLayoutLarge()
  : createAgentHqLayout();
const state = new OfficeState(layout);
```

Store the choice in a ref — don't re-evaluate on subsequent syncs.

- [ ] **Step 3: Commit**

```bash
git add lib/game-engine/agentHqLayoutLarge.ts components/office/GameCanvas.tsx
git commit -m "feat: add large office layout for 7-10 agents"
```

---

### Task 11: Delete Old Files & Final Verification

**Files:**
- Delete: `lib/detect-workflows.ts`
- Delete: `config/agent-roles.ts`
- Various remaining references

- [ ] **Step 1: Delete old files now that all consumers are updated**

```bash
rm lib/detect-workflows.ts config/agent-roles.ts
```

- [ ] **Step 2: Search for any remaining references to deleted exports**

Run: `grep -r "AGENT_ROLES\|AgentRoleKey\|AgentRoleConfig\|detect-workflows\|agent-roles\|DetectionResult\|WorkflowConfig\b" --include='*.ts' --include='*.tsx' -l`

Fix any remaining references. Common places: `AgentSprite.tsx`, `README.md`.

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 5: Run linter**

Run: `npx eslint . --ext .ts,.tsx`
Expected: Clean or only pre-existing warnings

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: delete old role-based files, cleanup remaining references"
```
