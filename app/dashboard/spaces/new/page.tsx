'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RepoPicker } from '@/components/spaces/RepoPicker';
import { WorkflowDetector } from '@/components/spaces/WorkflowDetector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { GHRepo } from '@/lib/github';
import type { DetectionResult, WorkflowConfig } from '@/lib/types';

export default function NewSpacePage() {
  const router = useRouter();
  const [selectedRepo, setSelectedRepo] = useState<GHRepo | null>(null);
  const [spaceName, setSpaceName] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [results, setResults] = useState<DetectionResult[] | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleRepoSelect(repo: GHRepo) {
    setSelectedRepo(repo);
    setSpaceName(repo.name);
    setDetecting(true);
    const res = await fetch('/api/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo: repo.full_name }),
    });
    setResults(await res.json());
    setDetecting(false);
  }

  async function handleCreate() {
    if (!selectedRepo || !results) return;
    setSaving(true);
    const workflow_config = Object.fromEntries(
      results.map((r) => [r.role, r.matched])
    ) as WorkflowConfig;
    const res = await fetch('/api/spaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: spaceName, repo_full_name: selectedRepo.full_name, workflow_config }),
    });
    const space = await res.json();
    router.push(`/spaces/${space.id}`);
  }

  return (
    <main className="max-w-2xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold font-mono">New Space</h1>
      <RepoPicker onSelect={handleRepoSelect} />
      {selectedRepo && (
        <Input value={spaceName} onChange={(e) => setSpaceName(e.target.value)}
          placeholder="Space name" className="font-mono" />
      )}
      {detecting && <p className="text-zinc-400 font-mono text-sm">Detecting workflows…</p>}
      {results && <WorkflowDetector results={results} />}
      {results && (
        <Button onClick={handleCreate} disabled={saving}>
          {saving ? 'Creating…' : 'Create Space →'}
        </Button>
      )}
    </main>
  );
}
