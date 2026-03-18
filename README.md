# Agent HQ

> Watch your GitHub Actions CI agents work in real time — as animated pixel-art characters in a top-down office.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_GITHUB_USERNAME/agent-hq&env=GITHUB_CLIENT_ID,GITHUB_CLIENT_SECRET,AUTH_SECRET,TOKEN_ENCRYPTION_SECRET&envDescription=See%20.env.example%20for%20setup%20instructions&project-name=agent-hq)

Each GitHub Actions workflow you care about gets mapped to an **agent role** (orchestrator, implementer, reviewer, etc.). When a workflow is running, its character walks to their desk and starts typing. When idle, they wander the lounge. The name tag turns teal and shows the active step name while working.

---

## How it works

```
GitHub Actions  →  /api/spaces/[id]/status  →  GameCanvas (canvas 2D)
                       (polls every 15s)            ↕
                   Neon Postgres (spaces/tokens)   OfficeState (game engine)
```

1. **Auth** — Sign in with GitHub OAuth. Your access token is AES-256-GCM encrypted before storage.
2. **Spaces** — A *space* is one repo + one workflow mapping. You can have multiple spaces (one per repo or project).
3. **Workflow detection** — When you create a space the app scans your `.github/workflows/` directory and scores each file against each agent role using filename patterns, trigger types, and name keywords.
4. **Live polling** — The space view polls `/api/spaces/[id]/status` every 15 seconds. That route calls the GitHub API for workflow runs, job steps, open PRs, and issues, then maps them to `AgentStatus` objects.
5. **Game engine** — `AgentStatus[]` drives a pixel-art canvas: active agents walk to their desk and type; idle agents teleport to lounge seats; the active step name appears in a tool bubble above the character's name tag.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Auth | Auth.js v5 (next-auth beta) — GitHub OAuth |
| Database | Neon Postgres (serverless) |
| ORM | Drizzle ORM |
| UI | Tailwind CSS v4, shadcn/ui, Geist font |
| Animations | Framer Motion (UI), Canvas 2D (game) |
| Testing | Vitest |
| Deployment | Vercel |

---

## Self-hosting

### 1 — Fork & deploy

Click **Deploy with Vercel** above, or:

```bash
git clone https://github.com/YOUR_USERNAME/agent-hq
cd agent-hq
```

### 2 — GitHub OAuth App

Go to [github.com/settings/developers](https://github.com/settings/developers) → **New OAuth App**:

- **Homepage URL**: `https://your-app.vercel.app`
- **Authorization callback URL**: `https://your-app.vercel.app/api/auth/callback/github`

Copy the **Client ID** and generate a **Client Secret**.

### 3 — Environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
# GitHub OAuth App (step 2 above)
GITHUB_CLIENT_ID=Iv1.xxxx
GITHUB_CLIENT_SECRET=xxxx

# Auth.js secret — run: openssl rand -base64 32
AUTH_SECRET=xxxx

# Token encryption key — run: openssl rand -base64 32
TOKEN_ENCRYPTION_SECRET=xxxx

# Neon Postgres connection string
DATABASE_URL=postgresql://...

# App URL
AUTH_URL=https://your-app.vercel.app
```

### 4 — Database

Add **Neon Postgres** from [Vercel Marketplace](https://vercel.com/marketplace) (`DATABASE_URL` is auto-provisioned), then run the schema push once:

```bash
vercel env pull .env.local   # pull all env vars locally
pnpm db:push                  # push schema to Neon
```

### 5 — Deploy

```bash
vercel --prod
```

---

## Local development

```bash
pnpm install
vercel link          # connect to your Vercel project
vercel env pull      # pull env vars to .env.local
pnpm db:push         # apply schema (first time only)
pnpm dev             # http://localhost:3000
```

Run tests:

```bash
pnpm test
```

---

## Customizing agent roles

Each agent role lives in [`config/agent-roles.ts`](config/agent-roles.ts). The six built-in roles are:

| Role | What it watches |
|---|---|
| `orchestrator` | Scheduled workflow, monitors board & plans |
| `implementer` | Triggered on issues, writes code |
| `reviewer` | Triggered on PR comments, reviews code |
| `ci_runner` | Push/PR CI — lint, build, test |
| `board_sync` | Keeps GitHub project board in sync |
| `pipeline` | Full autonomous implement-review-merge loop |

To add a role or rename one, edit `config/agent-roles.ts`:

```ts
export const AGENT_ROLES = {
  my_custom_agent: {
    label: 'My Agent',
    description: 'Does something useful',
    sprite: 'developer',       // builder | developer | manager | reviewer | scribe
    color: 'blue',
    idleAfterMinutes: 60,
    autoDetect: {
      filenamePatterns: ['my-agent*', 'custom*'],
      triggerTypes: ['workflow_dispatch'],
      nameKeywords: ['custom', 'agent'],
    },
  },
  // ...other roles
};
```

The `autoDetect` config drives the workflow scanner: files are scored by filename glob match (+3), trigger type match (+2), and name keyword match (+1 per keyword). The highest-scoring file is auto-selected.

> **Important**: The number of roles must match the `ROLES` array in [`components/office/GameCanvas.tsx`](components/office/GameCanvas.tsx) and the desk count in [`lib/game-engine/agentHqLayout.ts`](lib/game-engine/agentHqLayout.ts). If you add roles, add corresponding desks.

---

## Sharing a space

Each space has a **share link** (`/s/[share_token]`) that lets anyone view the live office without signing in. Enable it from the space settings. The share token is a random UUID stored in the database; disabling sharing revokes access immediately.

---

## Game engine

The pixel-art office runs entirely in a `<canvas>` element. The engine is in [`lib/game-engine/`](lib/game-engine/):

```
lib/game-engine/
├── types.ts          — constants, enums (CharacterState, Direction, tile sizes)
├── agentHqLayout.ts  — office map (24×16 tiles), furniture positions & metadata
├── tileMap.ts        — A* pathfinding, walkability checks
├── characters.ts     — character creation, per-frame state machine, animation
├── officeState.ts    — OfficeState class: seat assignment, lounge dispatch, PC animation
├── assetLoader.ts    — loads sprite PNGs and floor tile images
└── renderer.ts       — renderFloor + renderScene (Z-sorted drawables) + renderFrame
```

### Character states

| State | Behaviour |
|---|---|
| `TYPE` | At desk, typing animation (frame cols 3–6 depending on tool type) |
| `WALK` | Moving along A\*-computed path |
| `IDLE` | Standing still; wanders lounge tiles on a timer |
| `LOUNGE` | Seated in break room; transitions to `IDLE` → `WALK` → `TYPE` when activated |

### Z-sorting

All furniture and characters are collected as `ZDrawable` items and sorted by `zY` before drawing. Furniture `zY` is `pixelY + imageHeight`; characters get `ch.y + TILE_SIZE/2 + 0.5` so they render just after any object at the same tile. Chairs use `(row + 1) * TILE_SIZE` so the character always appears in front of their own chair.

### Workflow → character mapping

`GameCanvas.tsx` calls `state.setAgentActive(id, isActive, tool)` on each poll:

- **Active** (`working` or `queued`) → `sendToSeat(id)` — character walks to desk, enters `TYPE` state
- **Just became idle** → `sendToLounge(id)` — character teleports to a free lounge seat
- `currentStep` is passed as the `tool` string; it appears in the tool bubble above the name tag

### Sprite sheet layout

Each character PNG is `112 × 96` pixels — 7 columns × 3 direction rows (down / up / right+left):

| Col | Animation |
|---|---|
| 0–2 | Walk cycle (3 frames, mirrored for LEFT direction) |
| 3–4 | Typing |
| 5–6 | Reading (used when `currentStep` is Read/Grep/Glob/WebFetch) |

---

## API routes

| Route | Auth | Description |
|---|---|---|
| `GET /api/repos` | session | List user's GitHub repos (search) |
| `GET /api/detect?repo=owner/name` | session | Scan workflows, return detection results |
| `POST /api/spaces` | session | Create a new space |
| `GET /api/spaces/[id]` | session | Get space config |
| `PATCH /api/spaces/[id]` | session | Update workflow mapping or share settings |
| `DELETE /api/spaces/[id]` | session | Delete space |
| `GET /api/spaces/[id]/status` | session or share token | Live agent status + activity feed |
| `PATCH /api/spaces/[id]/share` | session | Toggle share link |

The status route accepts a `?share_token=` query param so the public share page can poll without a session cookie.

---

## Database schema

```
users
  id              text PK      (GitHub user ID)
  username        text
  avatar_url      text
  github_token_enc text        (AES-256-GCM encrypted GitHub access token)
  created_at      timestamp

spaces
  id              uuid PK
  owner_id        text FK → users.id
  name            text
  repo_full_name  text         (e.g. "acme/backend")
  workflow_config jsonb        (AgentRoleKey → { filename, cronExpression? })
  share_token     uuid unique
  share_enabled   boolean
  created_at      timestamp
```

---

## Security notes

- GitHub access tokens are encrypted at rest with AES-256-GCM using `TOKEN_ENCRYPTION_SECRET`. The raw token is never written to the database.
- The share token is a random UUID. Revoking sharing invalidates it immediately (the status route checks `share_enabled`).
- Auth.js JWT sessions are signed with `AUTH_SECRET`.

---

## Project structure

```
agent-hq/
├── app/
│   ├── (auth)/page.tsx          — landing / sign-in page
│   ├── dashboard/               — space list + new space wizard
│   ├── spaces/[id]/page.tsx     — live office view (authenticated)
│   ├── s/[share_token]/page.tsx — public share view
│   └── api/                     — all API routes
├── components/
│   ├── office/                  — GameCanvas, ActivityFeed, LogFeed, AgentDesk
│   ├── spaces/                  — RepoPicker, WorkflowDetector, SpaceCard
│   └── ui/                      — shadcn/ui primitives
├── config/
│   ├── agent-roles.ts           — role definitions & auto-detect config
│   └── office-layout.ts         — grid config, poll interval
├── lib/
│   ├── game-engine/             — canvas renderer + game loop
│   ├── build-agent-status.ts    — GitHub API → AgentStatus[]
│   ├── detect-workflows.ts      — workflow scoring/detection
│   ├── encrypt.ts               — AES-256-GCM token encryption
│   ├── auth.ts                  — Auth.js config
│   └── db/                      — Drizzle client + schema
└── __tests__/                   — Vitest unit tests
```
