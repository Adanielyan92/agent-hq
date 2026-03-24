'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RepoPicker } from '@/components/spaces/RepoPicker';
import { WorkflowDetector } from '@/components/spaces/WorkflowDetector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { GHRepo } from '@/lib/github';
import type { ClassifiedWorkflow } from '@/lib/types';
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';

export default function NewSpacePage() {
  const router = useRouter();
  const [selectedRepo, setSelectedRepo] = useState<GHRepo | null>(null);
  const [spaceName, setSpaceName] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [results, setResults] = useState<ClassifiedWorkflow[] | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleRepoSelect(repo: GHRepo) {
    setResults(null);
    setSelectedRepo(repo);
    setSpaceName(repo.name);
    setDetecting(true);
    try {
      const res = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: repo.full_name }),
      });
      setResults(await res.json());
    } catch {
      setResults([]);
    }
    setDetecting(false);
  }

  async function handleCreate() {
    if (!selectedRepo || !results) return;
    setSaving(true);
    const workflow_config = results;
    const res = await fetch('/api/spaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: spaceName,
        repo_full_name: selectedRepo.full_name,
        workflow_config,
      }),
    });
    const space = await res.json();
    router.push(`/spaces/${space.id}`);
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors font-mono mb-8"
        >
          <ArrowLeftIcon className="size-3.5" />
          Dashboard
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold font-mono text-zinc-100">New Space</h1>
          <p className="text-zinc-500 text-sm mt-1 font-mono">
            Connect a GitHub repository to monitor its CI agents.
          </p>
        </div>

        <div className="space-y-4">
          {/* Step 1: Repo */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 tabular-nums">
                01
              </span>
              <span className="text-sm font-mono text-zinc-300">Select Repository</span>
            </div>
            <RepoPicker onSelect={handleRepoSelect} selectedRepo={selectedRepo} />
          </div>

          {/* Step 2: Space name */}
          {selectedRepo && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 tabular-nums">
                  02
                </span>
                <span className="text-sm font-mono text-zinc-300">Space Name</span>
              </div>
              <Input
                value={spaceName}
                onChange={(e) => setSpaceName(e.target.value)}
                placeholder="Space name"
                className="font-mono bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
          )}

          {/* Step 3: Workflow detection */}
          {(detecting || results) && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 tabular-nums">
                  03
                </span>
                <span className="text-sm font-mono text-zinc-300">Detected Workflows</span>
                {detecting && (
                  <span className="ml-auto text-[11px] font-mono text-zinc-500 animate-pulse">
                    scanning…
                  </span>
                )}
              </div>
              {detecting ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-10 rounded-lg bg-zinc-800 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                  ))}
                </div>
              ) : (
                results && <WorkflowDetector results={results} />
              )}
            </div>
          )}

          {/* Create */}
          {results && !detecting && (
            <Button
              onClick={handleCreate}
              disabled={saving || !spaceName.trim()}
              size="lg"
              className="w-full font-mono"
            >
              {saving ? 'Creating…' : 'Create Space'}
              {!saving && <ArrowRightIcon className="size-4" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
