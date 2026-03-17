'use client';
import { useEffect, useState, useRef } from 'react';
import type { GHRepo } from '@/lib/github';
import { cn } from '@/lib/utils';
import { CheckIcon, ChevronDownIcon, SearchIcon } from 'lucide-react';

export function RepoPicker({
  onSelect,
  selectedRepo,
}: {
  onSelect: (repo: GHRepo) => void;
  selectedRepo: GHRepo | null;
}) {
  const [repos, setRepos] = useState<GHRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/repos')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setRepos(data);
        } else {
          setError('Could not load repos — try signing out and back in.');
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load repos');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const filtered = repos.filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="h-10 rounded-lg border border-zinc-800 bg-zinc-800 animate-pulse" />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-3">
        <p className="text-red-400 font-mono text-xs">{error}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm font-mono transition-all',
          'bg-zinc-800 hover:bg-zinc-800/80',
          open ? 'border-zinc-500 ring-1 ring-zinc-500/20' : 'border-zinc-700',
          selectedRepo ? 'text-zinc-100' : 'text-zinc-500'
        )}
      >
        <span>{selectedRepo ? selectedRepo.full_name : 'Choose a repository…'}</span>
        <ChevronDownIcon
          className={cn('size-4 text-zinc-500 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-zinc-800">
            <div className="relative flex items-center">
              <SearchIcon className="absolute left-2.5 size-3.5 text-zinc-500 pointer-events-none" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter repositories…"
                className="w-full bg-zinc-800 rounded-lg pl-8 pr-3 py-2 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 outline-none border border-zinc-700 focus:border-zinc-500 transition-colors"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto overscroll-contain">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-zinc-500 font-mono text-center">
                {search ? `No repos matching "${search}"` : 'No repositories found'}
              </p>
            ) : (
              <div className="p-1">
                {filtered.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      onSelect(r);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-mono transition-colors',
                      'hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100',
                      selectedRepo?.id === r.id && 'bg-zinc-800/50 text-zinc-100'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {r.private && (
                        <span className="text-[10px] text-zinc-600 border border-zinc-700 px-1 rounded shrink-0">
                          private
                        </span>
                      )}
                      <span className="truncate">{r.full_name}</span>
                    </div>
                    {selectedRepo?.id === r.id && (
                      <CheckIcon className="size-3.5 text-zinc-400 shrink-0 ml-2" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="px-3 py-2 border-t border-zinc-800">
            <p className="text-xs text-zinc-600 font-mono">{repos.length} repositories</p>
          </div>
        </div>
      )}
    </div>
  );
}
