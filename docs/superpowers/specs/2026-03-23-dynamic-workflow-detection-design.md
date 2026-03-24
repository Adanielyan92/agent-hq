# Dynamic Workflow Detection & Classification

**Date:** 2026-03-23
**Status:** Approved design, pending implementation

## Problem

The current detection system hardcodes 6 specific roles (orchestrator, implementer, reviewer, ci_runner, branch_sync, pipeline) with fixed filename patterns, trigger types, and keyword lists. This only works for repos structured exactly like the author's. Any other repo gets wrong matches, missed workflows, and phantom roles that don't exist.

The system should work for any GitHub Actions repo — discover all workflows, classify them intelligently, and let users override.

## Design

### Data Model

Replace `Record<AgentRoleKey, WorkflowConfigEntry | null>` (fixed 6-slot map) with `WorkflowEntry[]` (dynamic array).

```typescript
interface WorkflowEntry {
  filename: string;              // "ci.yml" — full basename with extension (matches GitHub run paths)
  kind: 'agent' | 'workflow';   // auto-detected
  label: string;                 // from YAML `name` field, or cleaned filename
  confidence: number;            // 0-1, how sure the classifier is about `kind`
  signals: string[];             // reasoning trail: ["uses anthropic/claude-code-action"]
  cronExpression?: string;
  // User overrides (null/undefined = use auto-detected value)
  userLabel?: string;
  userKind?: 'agent' | 'workflow';
  hidden?: boolean;              // hidden workflows don't appear in the office
}
```

The `spaces.workflow_config` DB column (jsonb) stores `WorkflowEntry[]`. The column type annotation changes but the column itself doesn't — jsonb accepts any shape.

**Filename convention:** `filename` always includes the extension (`"ci.yml"`, not `"ci"`). This matches GitHub's run path format (`.github/workflows/ci.yml`). The filename WITH extension is the unique key everywhere — in `WorkflowEntry.filename`, `AgentStatus.id`, and React `key` props. If a repo has both `ci.yml` and `ci.yaml`, both are kept as separate entries with distinct keys.

**Override resolution:** `entry.userLabel ?? entry.label` and `entry.userKind ?? entry.kind`. Simple field precedence, no merge logic.

**Note on `additionalFilenames`:** The old system allowed mapping multiple YAML files to a single role via `additionalFilenames`. The new system doesn't need this — each YAML file is its own entry. If multiple workflows serve the same logical purpose, they appear as separate agents in the office. Users can hide duplicates via the settings page if desired.

### AgentStatus (API response)

Replaces the current role-based `AgentStatus`:

```typescript
interface AgentStatus {
  id: string;                    // full filename with extension ("ci.yml") — unique key
  label: string;                 // resolved: userLabel > label > cleaned filename
  kind: 'agent' | 'workflow';   // resolved: userKind > kind
  state: AgentState;             // working | queued | success | failed | idle | coffee | sleeping
  workflowFile: string;          // full filename with extension
  runId: number | null;
  runName: string | null;
  runUrl: string | null;
  startedAt: string | null;
  conclusion: string | null;
  nextCronAt: string | null;
  currentIssue: string | null;   // kept for future use (linked issue tracking)
  currentStep: string | null;
  stepCurrent: number | null;
  stepTotal: number | null;
  jobSteps: AgentJobStep[];
  triggeredBy: string | null;
  triggeredByBot: boolean;
  event: string | null;
  logSnippet: string | null;
}
```

The `role: AgentRoleKey` field is gone. Components key on `id` (filename-based) instead. `SpaceStatusResponse` keeps the same shape (`{ agents: AgentStatus[], activityFeed, fetchedAt }`) — only the `AgentStatus` type changes.

### Workflow Classifier

New file: `lib/classify-workflows.ts`. Replaces `lib/detect-workflows.ts` and `config/agent-roles.ts`.

**Input — extended WorkflowMeta:**

```typescript
interface WorkflowMeta {
  filename: string;              // WITH extension ("ci.yml") — consistent with WorkflowEntry
  name: string;                  // YAML `name` field, or filename as fallback
  triggerTypes: string[];
  cronExpression?: string;
  usesActions: string[];         // e.g. ["anthropic/claude-code-action@v1"]
  referencedSecrets: string[];   // e.g. ["ANTHROPIC_API_KEY"]
  referencedEnvVars: string[];   // e.g. ["OPENAI_API_KEY"]
}
```

The classifier output `ClassifiedWorkflow` is identical to `WorkflowEntry` minus the user override fields:

```typescript
interface ClassifiedWorkflow {
  filename: string;              // "ci.yml"
  kind: 'agent' | 'workflow';
  label: string;
  confidence: number;
  signals: string[];
  cronExpression?: string;
}
```

When creating a space, `ClassifiedWorkflow` entries are stored as `WorkflowEntry[]` (the user override fields start as undefined). `ClassifiedWorkflow` is defined as `Omit<WorkflowEntry, 'userLabel' | 'userKind' | 'hidden'>` — a derived type, not a standalone definition.

**Detect API contract:**
- Request: `POST /api/detect` with body `{ repo: string }`
- Response: `ClassifiedWorkflow[]` (flat array, one per YAML file found)
- The old `DetectionResult[]` response shape is removed entirely.

Extraction happens in the detect API route by walking the parsed YAML's `jobs.*.steps[].uses` and `jobs.*.steps[].env` / `jobs.*.env` fields. If a YAML file fails to parse (malformed, uses unsupported features), it is still included as a `ClassifiedWorkflow` with `kind: 'workflow'`, `confidence: 0.1`, and `signals: ["yaml parse error — defaulted to workflow"]`.

**Classification — weighted signal cascade:**

| Priority | Signal | Indicates | Confidence |
|----------|--------|-----------|------------|
| 1 | Uses known AI action | agent | 0.9 |
| 2 | References AI-related secret/env var | agent | 0.7 |
| 3 | Filename or name contains AI keywords | agent | 0.6 |
| 4 | Filename or name contains CI keywords | workflow | 0.6 |
| 5 | Trigger type heuristic (fallback only) | either | 0.3 |

Known AI actions (extensible list):
- `anthropic/claude-code-action*`
- `github/copilot-*`
- `coderabbitai/*`

Known AI secrets/env vars:
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `CLAUDE_*`, `AI_*`

AI keywords in name/filename:
- `claude`, `copilot`, `agent`, `ai`, `gpt`, `llm`, `anthropic`, `openai`

CI keywords in name/filename:
- `ci`, `test`, `build`, `lint`, `deploy`, `release`, `sync`, `merge`, `check`, `publish`

**Signal resolution:** Signals are NOT additive — each signal is independent. The classifier collects all matching signals, then picks the kind with the highest single-signal confidence. All matching signals are recorded in the `signals` array for transparency.

Resolution rules:
1. Take the highest-confidence signal. That determines `kind` and `confidence`.
2. On a tie (e.g., AI keyword at 0.6 vs CI keyword at 0.6), **agent wins** — it's a more useful misclassification since users notice and can fix it easily via settings.
3. If no signal matches at all, default to `kind: 'workflow'` with `confidence: 0.2`.

**Output:** `ClassifiedWorkflow[]` — one entry per YAML file found, no predefined slots.

### Label Generation

Resolution order:
1. `entry.userLabel` — if user has overridden the name
2. YAML `name` field — if present
3. Cleaned filename — strip extension, replace hyphens/underscores with spaces, title-case

### Status Computation

`buildAgentStatus` changes from iterating `AGENT_ROLES` keys to iterating `WorkflowEntry[]`:

- Filter out `hidden` entries
- For each entry, find matching runs by filename (same logic as today)
- Compute state using the same time-based logic:
  - `deskGraceMinutes`: constants in `buildAgentStatus` — `AGENT_DESK_GRACE = 15` and `WORKFLOW_DESK_GRACE = 5`. Selected by resolved `kind`. No per-entry override needed.
  - Coffee/sleep thresholds: unchanged (60min / 180min)
- Sort output: agents first (alphabetically by filename), then workflows (alphabetically by filename). This stable sort ensures consistent desk assignment across page loads.
- Return `AgentStatus[]` with `id` = filename (with extension)

### Game Engine Adaptation

**Dynamic character management:**

`GameCanvas` no longer has a fixed `ROLES` array. On each status sync:
- Compare incoming `agents[]` IDs against existing characters
- Add new characters for IDs that don't exist yet
- Remove characters for IDs that disappeared (workflow was hidden/deleted)
- Update state for existing characters

`OfficeState` already supports `addAgent(id, paletteIndex, roleName)`. We add a `removeAgent(id)` method that frees the seat and deletes the character. Freed seats remain empty — existing agents do NOT shift to fill gaps. This preserves desk stability (agent X always sits at the same desk for the lifetime of a session).

**Seat assignment:** Agents are added in the stable sort order (agents first, alphabetical). `findFreeSeat()` assigns the next available desk. This means the same workflows always get the same desks across page loads.

**Sprite assignment:** Palette index = `i % 6`, cycling through available character sprite sheets. Same deterministic approach as colors — the Nth agent always gets the same sprite. No per-workflow sprite configuration needed.

**Layout selection:**
- ≤6 visible workflows → current 6-desk layout (no change)
- 7-10 → larger layout variant (new file: `lib/game-engine/agentHqLayoutLarge.ts`)
- 11+ → use the 10-desk layout; extra agents beyond desk capacity stay in the lounge permanently (they still show in the roster strip and receive status updates, they just don't get a desk)
- Layout is selected on initial load based on the initial agent count. If the count changes later (re-detect adds/removes), layout only re-evaluates on next full page load — NOT hot-swapped. This avoids disruptive visual resets mid-session. The `GameCanvas` stores the layout choice in a ref and only checks it on mount.

**Color assignment:** Replace hardcoded `ROLE_COLORS` maps with deterministic hash:

```typescript
const PALETTE = ['#a78bfa','#60a5fa','#fbbf24','#34d399','#94a3b8','#f472b6','#fb923c','#22d3ee'];
function colorForWorkflow(filename: string): string {
  let hash = 0;
  for (const ch of filename) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
```

Used everywhere: `AgentDesk`, `LogFeed`, `OfficeFloor` roster, name tags in the renderer.

### Space Settings Page

**Route:** `/spaces/[id]/settings`

**Accessible from:** Space header (gear icon or "Settings" link).

**Contents:**
- Workflow list showing all detected workflows
- Per workflow:
  - Editable label (text input, placeholder = auto-detected name)
  - Kind toggle (agent / workflow)
  - Visibility toggle (eye icon)
  - Confidence + signals tooltip
- "Re-detect" button: calls `POST /api/detect` with the repo name, receives fresh `ClassifiedWorkflow[]`, then merges client-side (this is a single-owner app — no concurrent edit concern):
  - **New workflows** (filename exists in fresh results but not in current config): added with auto-detected values
  - **Removed workflows** (filename exists in current config but not in fresh results): marked with `hidden: true` and shown with a "removed from repo" badge. User can delete them manually or leave them hidden.
  - **Existing workflows**: auto-detected fields (`kind`, `label`, `confidence`, `signals`) are updated from the fresh scan. User overrides (`userLabel`, `userKind`, `hidden`) are preserved.
- Save button: `PATCH /api/spaces/[id]` with updated `workflow_config`

### Migration (existing spaces)

Existing spaces store the old `Record<role, entry>` format. Rather than a batch DB migration:

- The status route checks if `workflow_config` is an array or object
- If object (old format): convert on-the-fly to `WorkflowEntry[]` and write back to DB
- Conversion logic for each `[role, entry]` pair where entry is non-null:
  - `filename`: from `entry.filename` (already has extension)
  - `kind`: inferred from old role name — orchestrator/implementer/reviewer/pipeline → `'agent'`, ci_runner/branch_sync → `'workflow'`
  - `label`: from the old role's label (e.g., "Orchestrator", "CI Runner"). These were the hardcoded `AGENT_ROLES[role].label` values — hardcode the mapping in the migration function since the config file is being deleted.
  - `confidence`: 0.5 (we don't know, it was user-confirmed by creating the space)
  - `signals`: `["migrated from legacy config"]`
  - `additionalFilenames`: dropped. If the old entry had additional filenames, each becomes its own `WorkflowEntry` with the same kind/label + " (alt)" suffix.
  - `cronExpression`: preserved from old entry

A helper `migrateOldConfig(config: Record<string, any>): WorkflowEntry[]` lives in `lib/build-agent-status.ts`. The migration is idempotent — if the status route runs twice concurrently during migration, both produce the same `WorkflowEntry[]` output (deterministic conversion), so the last write is harmless. The `deskGraceMinutes` for migrated `branch_sync` entries changes from 3 to 5 (the standard workflow grace) — acceptable since it's a minor behavioral difference.

### File Changes

**Create:**
- `lib/classify-workflows.ts` — classifier
- `app/spaces/[id]/settings/page.tsx` — settings page
- `lib/game-engine/agentHqLayoutLarge.ts` — 10-desk layout (same architectural style as current 6-desk layout: wider room, 5 desks per wing, same hallway/lounge structure. Exact tile positions are an implementation detail — follow the pattern in `agentHqLayout.ts`)

**Delete:**
- `config/agent-roles.ts` — replaced by classifier
- `lib/detect-workflows.ts` — replaced by classifier

**Heavy modifications:**
- `lib/types.ts` — WorkflowEntry, new AgentStatus shape, remove AgentRoleKey/AgentRoleConfig
- `lib/build-agent-status.ts` — iterate WorkflowEntry[] instead of AGENT_ROLES
- `app/api/detect/route.ts` — extract actions/secrets from YAML, use classifier
- `app/api/spaces/[id]/status/route.ts` — lazy migration, dynamic agent list
- `components/office/GameCanvas.tsx` — dynamic character creation/removal
- `components/spaces/WorkflowDetector.tsx` — show classified flat list
- `lib/game-engine/officeState.ts` — add removeAgent(), dynamic seat management

**Light modifications:**
- `components/office/AgentDesk.tsx` — hash-based colors, remove role enum refs
- `components/office/LogFeed.tsx` — hash-based colors
- `components/office/OfficeFloor.tsx` — iterate dynamic agents
- `lib/game-engine/agentHqLayout.ts` — remove AGENT_SEAT_INDEX
- `lib/game-engine/renderer.ts` — remove orchestrator special-casing (ORCH_SCALE)
- `lib/db/schema.ts` — type annotation changes to `WorkflowEntry[] | LegacyWorkflowConfig` (union type during transition; the lazy migration in the status route normalizes to `WorkflowEntry[]` on first access, after which only the new format exists)
- `app/dashboard/spaces/new/page.tsx` — adapt to new detection response shape

**Unchanged:**
- Game engine core (tileMap, pathfinding, characters, renderer animation)
- Coffee/sleep idle states, lounge mode, floating emoji bubbles
- Auth, encryption, GitHub API fetching
- Activity feed, share link system

### What This Enables

- Any GitHub Actions repo works out of the box
- AI agent workflows (Claude, Copilot, CodeRabbit) are automatically identified
- Plain CI/CD workflows are correctly classified
- Users can fix misclassifications without touching code
- New workflows are picked up on re-detect
- The office scales to the actual workflow count
