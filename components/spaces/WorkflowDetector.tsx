'use client';
import type { ClassifiedWorkflow } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

export function WorkflowDetector({ results }: { results: ClassifiedWorkflow[] }) {
  return (
    <div className="space-y-2">
      {results.map((r) => {
        const isAgent = r.kind === 'agent';
        return (
          <div key={r.filename} className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-2 font-mono text-sm">
              <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-semibold ${
                isAgent
                  ? 'bg-violet-500/15 text-violet-400 border border-violet-500/30'
                  : 'bg-zinc-700/40 text-zinc-400 border border-zinc-600/30'
              }`}>
                {r.kind}
              </span>
              <span className="text-zinc-100">{r.label}</span>
              <span className="text-zinc-500">← {r.filename}</span>
            </div>
            <Badge variant={r.confidence >= 0.7 ? 'default' : r.confidence >= 0.4 ? 'secondary' : 'destructive'}>
              {r.confidence >= 0.7 ? 'confident' : r.confidence >= 0.4 ? 'likely' : 'guess'}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
