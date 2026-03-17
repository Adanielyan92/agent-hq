'use client';
import useSWR from 'swr';
import { OFFICE_LAYOUT } from '@/config/office-layout';
import { AgentDesk } from './AgentDesk';
import { ActivityFeed } from './ActivityFeed';
import type { SpaceStatusResponse } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  spaceId: string;
  shareToken?: string;   // present on public share view
  readOnly?: boolean;
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

  if (isLoading) return <p className="font-mono text-zinc-500 text-sm">Loading office…</p>;
  if (error || !data) return <p className="font-mono text-red-400 text-sm">Failed to load status.</p>;

  return (
    <div>
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${OFFICE_LAYOUT.gridCols}, minmax(0, 1fr))` }}
      >
        {data.agents.map((agent) => (
          <AgentDesk key={agent.role} agent={agent} />
        ))}
      </div>
      <ActivityFeed items={data.activityFeed} />
      <p className="font-mono text-xs text-zinc-600 mt-4 text-right">
        Updated {new Date(data.fetchedAt).toLocaleTimeString()}
      </p>
    </div>
  );
}
