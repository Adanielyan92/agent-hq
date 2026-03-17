import type { AgentStatus } from '@/lib/types';
import { AGENT_ROLES } from '@/config/agent-roles';
import { AgentSprite } from './AgentSprite';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow, parseISO } from 'date-fns';

const STATE_LABELS: Record<AgentStatus['state'], string> = {
  working:  'Working',
  queued:   'Queued',
  success:  'Done',
  failed:   'Failed',
  sleeping: 'Sleeping',
  idle:     'Idle',
};

const STATE_COLORS: Record<AgentStatus['state'], string> = {
  working:  'bg-blue-500/20 text-blue-300 border-blue-500/30',
  queued:   'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  success:  'bg-green-500/20 text-green-300 border-green-500/30',
  failed:   'bg-red-500/20 text-red-300 border-red-500/30',
  sleeping: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  idle:     'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

export function AgentDesk({ agent }: { agent: AgentStatus }) {
  const role = AGENT_ROLES[agent.role];

  const subtitle = agent.state === 'sleeping' && agent.nextCronAt
    ? `Next: ${formatDistanceToNow(parseISO(agent.nextCronAt))}`
    : agent.runName
    ? agent.runName.slice(0, 24)
    : '';

  return (
    <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
      <AgentSprite sprite={role.sprite} state={agent.state} />
      <div className="text-center space-y-1 w-full">
        <p className="font-mono text-sm font-medium text-zinc-100">{role.label}</p>
        <Badge className={`text-xs font-mono ${STATE_COLORS[agent.state]}`}>
          {STATE_LABELS[agent.state]}
        </Badge>
        {subtitle && (
          <p className="font-mono text-xs text-zinc-500 truncate">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
