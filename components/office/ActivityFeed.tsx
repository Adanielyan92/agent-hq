import type { ActivityItem } from '@/lib/types';
import { formatDistanceToNow, parseISO } from 'date-fns';

const ICONS: Record<ActivityItem['type'], string> = {
  run_success: '✅',
  run_failed:  '❌',
  pr_opened:   '🔄',
  pr_merged:   '✅',
  issue_ready: '⏳',
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-6 pt-4 border-t border-zinc-800">
      <p className="font-mono text-xs text-zinc-500 mb-3">Recent Activity</p>
      <div className="flex flex-wrap gap-3">
        {items.map((item) => (
          <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 font-mono text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
            <span>{ICONS[item.type]}</span>
            <span className="truncate max-w-[140px]">{item.label}</span>
            <span className="text-zinc-600">{formatDistanceToNow(parseISO(item.timestamp))} ago</span>
          </a>
        ))}
      </div>
    </div>
  );
}
