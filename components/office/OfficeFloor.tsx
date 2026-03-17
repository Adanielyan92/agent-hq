'use client';
import useSWR from 'swr';
import { OFFICE_LAYOUT } from '@/config/office-layout';
import { AgentDesk, type DeskVisitor } from './AgentDesk';
import { ActivityFeed } from './ActivityFeed';
import type { SpaceStatusResponse, AgentStatus, AgentRoleKey } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  spaceId: string;
  shareToken?: string;
  readOnly?: boolean;
}

// The 6 roles, grouped into 2 "wings"
const LEFT_WING  = ['orchestrator', 'implementer', 'reviewer'] as const;
const RIGHT_WING = ['ci_runner',    'board_sync',  'pipeline' ] as const;

// Position index 0-5 so we know which direction visitors come from
const ROLE_INDEX: Record<string, number> = {
  orchestrator: 0, implementer: 1, reviewer: 2,
  ci_runner: 3, board_sync: 4, pipeline: 5,
};

function AgentsByRole(agents: AgentStatus[], roles: readonly string[]) {
  return roles.map((role) => agents.find((a) => a.role === role)).filter(Boolean) as AgentStatus[];
}

function StatDot({ state }: { state: AgentStatus['state'] }) {
  const cls = {
    working:  'bg-cyan-400 animate-pulse',
    queued:   'bg-amber-400 animate-pulse',
    success:  'bg-emerald-400',
    failed:   'bg-red-500',
    sleeping: 'bg-indigo-400',
    idle:     'bg-zinc-700',
  }[state];
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${cls}`} />;
}

// ── Derive which agents are visiting which desks ─────────────────────
// Returns: { visitorMap, awaySet }
function computeVisitors(agents: AgentStatus[]): {
  visitorMap: Map<string, DeskVisitor>;
  awaySet: Set<string>;
} {
  const visitorMap = new Map<string, DeskVisitor>();
  const byRole = new Map(agents.map(a => [a.role, a]));

  const reviewer    = byRole.get('reviewer');
  const implementer = byRole.get('implementer');
  const orchestrator = byRole.get('orchestrator');
  const ci          = byRole.get('ci_runner');

  // Reviewer walks to implementer's desk for a peer code review
  if (reviewer?.state === 'working') {
    const ev = reviewer.event ?? '';
    const isPREvent = ['pull_request', 'pull_request_review',
                       'pull_request_review_comment', 'issue_comment'].includes(ev);
    if (isPREvent && implementer) {
      const reviewerIdx    = ROLE_INDEX['reviewer']    ?? 0;
      const implementerIdx = ROLE_INDEX['implementer'] ?? 0;
      visitorMap.set('implementer', {
        role: 'reviewer',
        label: 'peer review',
        fromRight: reviewerIdx > implementerIdx,
      });
    }
  }

  // Orchestrator visits the agent it just delegated a task to
  if (orchestrator?.state === 'working') {
    for (const agent of agents) {
      if (agent.triggeredByBot && agent.state === 'working' && agent.role !== 'orchestrator') {
        if (!visitorMap.has(agent.role)) {
          const orchIdx   = ROLE_INDEX['orchestrator'] ?? 0;
          const targetIdx = ROLE_INDEX[agent.role]     ?? 0;
          visitorMap.set(agent.role, {
            role: 'orchestrator',
            label: 'delegating task',
            fromRight: orchIdx > targetIdx,
          });
          break;
        }
      }
    }
  }

  // CI runner walks over to implementer after they push code
  if (ci?.state === 'working') {
    const target = byRole.get('implementer');
    if (target && (target.state === 'success' || target.state === 'working')) {
      if (!visitorMap.has('implementer')) {
        visitorMap.set('implementer', {
          role: 'ci_runner',
          label: 'running checks',
          fromRight: true,
        });
      }
    }
  }

  // The set of roles that are currently "away" (visiting elsewhere)
  const awaySet = new Set([...visitorMap.values()].map(v => v.role));

  return { visitorMap, awaySet };
}

export function OfficeFloor({ spaceId, shareToken, readOnly = false }: Props) {
  const url = shareToken
    ? `/api/spaces/${spaceId}/status?token=${shareToken}`
    : `/api/spaces/${spaceId}/status`;

  const { data, error, isLoading } = useSWR<SpaceStatusResponse>(
    url,
    fetcher,
    { refreshInterval: OFFICE_LAYOUT.pollIntervalMs }
  );

  if (isLoading) {
    return (
      <div className="office-loading">
        <div className="office-floor-skeleton">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="desk-skeleton" style={{ animationDelay: `${i * 110}ms` }} />
          ))}
        </div>
        <p className="font-mono text-zinc-700 text-[10px] mt-3 text-center tracking-[0.2em] uppercase">
          Connecting to office…
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="office-room p-6">
        <p className="font-mono text-red-400 text-xs">Failed to load agent status.</p>
      </div>
    );
  }

  const agents    = data.agents;
  const working   = agents.filter((a) => a.state === 'working');
  const subAgents = agents.filter((a) => a.triggeredByBot);
  const leftAgents  = AgentsByRole(agents, LEFT_WING);
  const rightAgents = AgentsByRole(agents, RIGHT_WING);

  const { visitorMap, awaySet } = computeVisitors(agents);

  return (
    <div className="office-room">

      {/* ── Floor tile texture ── */}
      <div className="office-floor-bg" />

      {/* ── Ceiling strip with fluorescent lights ── */}
      <div className="office-ceiling-strip">
        <div className="ceiling-light" />
        <div className="ceiling-light" />
        <div className="ceiling-light" />
      </div>

      {/* ── Status bar ── */}
      <div className="office-statusbar">
        <span className="font-mono text-[10px] text-zinc-600 uppercase tracking-[0.18em]">
          Office Floor
        </span>

        <div className="flex items-center gap-3">
          {working.length > 0 && (
            <span className="font-mono text-[10px] text-cyan-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              {working.length} active
            </span>
          )}
          {subAgents.length > 0 && (
            <span className="font-mono text-[10px] text-amber-400 flex items-center gap-1.5">
              ⚡ {subAgents.length} sub-agent{subAgents.length > 1 ? 's' : ''}
            </span>
          )}
          {visitorMap.size > 0 && (
            <span className="font-mono text-[10px] text-violet-400 flex items-center gap-1.5">
              🚶 {visitorMap.size} collaborating
            </span>
          )}
          <span className="font-mono text-[10px] text-zinc-700 tabular-nums">
            {new Date(data.fetchedAt).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* ── Office wings ── */}
      <div className="office-wings">

        {/* Left wing */}
        <div className="office-wing">
          <div className="wing-label">
            <span className="wing-label-text">Agent Wing A</span>
          </div>
          <div className="wing-desks">
            {leftAgents.map((agent) => (
              <AgentDesk
                key={agent.role}
                agent={agent}
                visitor={visitorMap.get(agent.role) ?? null}
                isAway={awaySet.has(agent.role)}
              />
            ))}
          </div>
        </div>

        {/* Center divider / hallway */}
        <div className="office-hallway">
          <div className="hallway-stripe" />
          <div className="hallway-stripe" />
          <div className="hallway-stripe" />
        </div>

        {/* Right wing */}
        <div className="office-wing">
          <div className="wing-label">
            <span className="wing-label-text">Agent Wing B</span>
          </div>
          <div className="wing-desks">
            {rightAgents.map((agent) => (
              <AgentDesk
                key={agent.role}
                agent={agent}
                visitor={visitorMap.get(agent.role) ?? null}
                isAway={awaySet.has(agent.role)}
              />
            ))}
          </div>
        </div>

      </div>

      {/* ── Agent roster strip ── */}
      <div className="office-roster">
        {agents.map((a) => (
          <div key={a.role} className="roster-item">
            <StatDot state={a.state} />
            <span className="font-mono text-[10px] text-zinc-500 capitalize tracking-wide">
              {a.role.replace('_', ' ')}
            </span>
            {awaySet.has(a.role) && (
              <span className="font-mono text-[10px] text-violet-500">↗</span>
            )}
          </div>
        ))}
      </div>

      {/* ── Activity feed ── */}
      {data.activityFeed.length > 0 && (
        <div className="office-footer">
          <p className="font-mono text-[10px] text-zinc-600 uppercase tracking-[0.15em] mb-2">
            Recent Activity
          </p>
          <ActivityFeed items={data.activityFeed} />
        </div>
      )}
    </div>
  );
}
