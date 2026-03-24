'use client';
import useSWR from 'swr';
import { OFFICE_LAYOUT } from '@/config/office-layout';
import { GameCanvas } from './GameCanvas';
import { LogFeed } from './LogFeed';
import { ActivityFeed } from './ActivityFeed';
import type { SpaceStatusResponse, AgentStatus } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  spaceId: string;
  shareToken?: string;
  readOnly?: boolean;
}

function StatDot({ state }: { state: AgentStatus['state'] }) {
  const cls = {
    working:  'bg-cyan-400 animate-pulse',
    queued:   'bg-amber-400 animate-pulse',
    success:  'bg-emerald-400',
    failed:   'bg-red-500',
    coffee:   'bg-orange-400',
    sleeping: 'bg-indigo-400',
    idle:     'bg-zinc-700',
  }[state] ?? 'bg-zinc-700';
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${cls}`} />;
}

export function OfficeFloor({ spaceId, shareToken, readOnly = false }: Props) {
  const url = shareToken
    ? `/api/spaces/${spaceId}/status?token=${shareToken}`
    : `/api/spaces/${spaceId}/status`;

  const { data, isLoading } = useSWR<SpaceStatusResponse>(
    url,
    fetcher,
    { refreshInterval: OFFICE_LAYOUT.pollIntervalMs }
  );

  const agents = data?.agents ?? [];
  const working = agents.filter((a) => a.state === 'working');

  return (
    <div className="relative flex flex-col" style={{ minHeight: '100%' }}>

      {/* ── Game canvas fills available height ── */}
      <div className="relative flex-1" style={{ minHeight: '480px' }}>
        <GameCanvas agents={agents} />

        {/* ── Status pill overlay ── */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full border border-zinc-800/80 pointer-events-none">
          <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest">
            Agent Office
          </span>
          {working.length > 0 && (
            <span className="font-mono text-[9px] text-cyan-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              {working.length} active
            </span>
          )}
          {data && (
            <span className="font-mono text-[9px] text-zinc-600 tabular-nums">
              {new Date(data.fetchedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* ── Connecting overlay ── */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="font-mono text-[10px] text-zinc-600 tracking-widest animate-pulse uppercase">
              Connecting…
            </p>
          </div>
        )}
      </div>

      {/* ── Agent roster strip ── */}
      {agents.length > 0 && (
        <div className="flex flex-wrap gap-3 px-4 py-2 border-t border-zinc-800/60 bg-zinc-950/80">
          {agents.map((a) => (
            <div key={a.id} className="flex items-center gap-1.5">
              <StatDot state={a.state} />
              <span className={`inline-block px-1 py-0 rounded text-[8px] uppercase tracking-wider font-semibold ${
                a.kind === 'agent'
                  ? 'bg-violet-500/15 text-violet-400 border border-violet-500/30'
                  : 'bg-zinc-700/40 text-zinc-400 border border-zinc-600/30'
              }`}>
                {a.kind}
              </span>
              <span className="font-mono text-[9px] text-zinc-500 capitalize tracking-wide">
                {a.label}
              </span>
              {a.currentStep && (
                <span className="font-mono text-[9px] text-zinc-700 truncate max-w-[80px]">
                  · {a.currentStep}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Activity feed ── */}
      {data?.activityFeed && data.activityFeed.length > 0 && (
        <div className="px-4 py-2 border-t border-zinc-800/60">
          <ActivityFeed items={data.activityFeed} />
        </div>
      )}

      {/* ── Live log panel ── */}
      <LogFeed agents={agents} />
    </div>
  );
}
