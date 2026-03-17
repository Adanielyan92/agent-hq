import type { AgentState } from '@/lib/types';
import type { AgentRoleConfig } from '@/lib/types';

interface Props {
  sprite: AgentRoleConfig['sprite'];
  state: AgentState;
}

export function AgentSprite({ sprite, state }: Props) {
  return (
    <div className="relative flex items-center justify-center">
      <div className={`sprite sprite-${sprite} sprite-${state}`} />
    </div>
  );
}
