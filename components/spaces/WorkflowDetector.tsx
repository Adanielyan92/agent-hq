'use client';
import type { DetectionResult } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { AGENT_ROLES } from '@/config/agent-roles';

export function WorkflowDetector({ results }: { results: DetectionResult[] }) {
  return (
    <div className="space-y-2">
      {results.map((r) => (
        <div key={r.role} className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-zinc-800">
          <div className="font-mono text-sm">
            <span className="text-zinc-100">{AGENT_ROLES[r.role].label}</span>
            <span className="text-zinc-500 ml-3">
              {r.matched ? `← ${r.matched.filename}` : '← Not detected'}
            </span>
          </div>
          <Badge variant={r.confidence === 'confident' ? 'default' : r.confidence === 'low' ? 'secondary' : 'destructive'}>
            {r.confidence}
          </Badge>
        </div>
      ))}
    </div>
  );
}
