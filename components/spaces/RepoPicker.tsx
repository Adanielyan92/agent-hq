'use client';
import { useEffect, useState } from 'react';
import type { GHRepo } from '@/lib/github';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function RepoPicker({ onSelect }: { onSelect: (repo: GHRepo) => void }) {
  const [repos, setRepos] = useState<GHRepo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/repos').then((r) => r.json()).then((data: GHRepo[]) => {
      setRepos(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <p className="text-zinc-400 font-mono text-sm">Loading repos…</p>;

  return (
    <Select onValueChange={(val) => {
      const repo = repos.find((r) => r.full_name === val);
      if (repo) onSelect(repo);
    }}>
      <SelectTrigger className="w-full font-mono"><SelectValue placeholder="Select a repository" /></SelectTrigger>
      <SelectContent>
        {repos.map((r) => (
          <SelectItem key={r.id} value={r.full_name} className="font-mono">{r.full_name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
