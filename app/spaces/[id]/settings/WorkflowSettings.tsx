'use client';

import { useState, useCallback } from 'react';
import type { WorkflowEntry, ClassifiedWorkflow } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  EyeIcon,
  EyeOffIcon,
  RefreshCwIcon,
  SaveIcon,
  InfoIcon,
  BotIcon,
  WorkflowIcon,
} from 'lucide-react';

function mergeDetection(
  existing: WorkflowEntry[],
  fresh: ClassifiedWorkflow[]
): WorkflowEntry[] {
  const freshMap = new Map(fresh.map((f) => [f.filename, f]));
  const existingMap = new Map(existing.map((e) => [e.filename, e]));
  const merged: WorkflowEntry[] = [];

  for (const entry of existing) {
    const freshEntry = freshMap.get(entry.filename);
    if (freshEntry) {
      merged.push({
        ...entry,
        kind: freshEntry.kind,
        label: freshEntry.label,
        confidence: freshEntry.confidence,
        signals: freshEntry.signals,
        cronExpression: freshEntry.cronExpression,
      });
    } else {
      merged.push({ ...entry, hidden: true });
    }
  }

  for (const f of freshMap.values()) {
    if (!existingMap.has(f.filename)) {
      merged.push({ ...f });
    }
  }

  return merged;
}

interface WorkflowSettingsProps {
  spaceId: string;
  repoFullName: string;
  initialEntries: WorkflowEntry[];
}

export function WorkflowSettings({
  spaceId,
  repoFullName,
  initialEntries,
}: WorkflowSettingsProps) {
  const [entries, setEntries] = useState<WorkflowEntry[]>(initialEntries);
  const [savedEntries, setSavedEntries] = useState<WorkflowEntry[]>(initialEntries);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const hasChanges = JSON.stringify(entries) !== JSON.stringify(savedEntries);

  const updateEntry = useCallback(
    (filename: string, patch: Partial<WorkflowEntry>) => {
      setEntries((prev) =>
        prev.map((e) => (e.filename === filename ? { ...e, ...patch } : e))
      );
    },
    []
  );

  const handleRedetect = async () => {
    setDetecting(true);
    try {
      const res = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: repoFullName }),
      });
      if (!res.ok) throw new Error('Detection failed');
      const fresh: ClassifiedWorkflow[] = await res.json();
      setEntries((prev) => mergeDetection(prev, fresh));
    } catch {
      setSaveMessage('Failed to re-detect workflows');
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setDetecting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch(`/api/spaces/${spaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow_config: entries }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSavedEntries(entries);
      setSaveMessage('Saved');
      setTimeout(() => setSaveMessage(null), 2000);
    } catch {
      setSaveMessage('Failed to save');
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <TooltipProvider>
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold font-mono text-zinc-300">
            Workflows
          </h2>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-[11px] font-mono text-amber-500">
                Unsaved changes
              </span>
            )}
            {saveMessage && (
              <span
                className={`text-[11px] font-mono ${
                  saveMessage === 'Saved' ? 'text-emerald-500' : 'text-red-400'
                }`}
              >
                {saveMessage}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRedetect}
              disabled={detecting}
              className="font-mono text-xs"
            >
              <RefreshCwIcon
                className={`size-3.5 mr-1.5 ${detecting ? 'animate-spin' : ''}`}
              />
              {detecting ? 'Detecting...' : 'Re-detect'}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="font-mono text-xs"
            >
              <SaveIcon className="size-3.5 mr-1.5" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
            <p className="font-mono text-sm text-zinc-500">
              No workflows detected yet.
            </p>
            <p className="font-mono text-xs text-zinc-600 mt-1">
              Click &quot;Re-detect&quot; to scan your repository.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <WorkflowRow
                key={entry.filename}
                entry={entry}
                onUpdate={updateEntry}
              />
            ))}
          </div>
        )}
      </section>
    </TooltipProvider>
  );
}

function WorkflowRow({
  entry,
  onUpdate,
}: {
  entry: WorkflowEntry;
  onUpdate: (filename: string, patch: Partial<WorkflowEntry>) => void;
}) {
  const displayLabel = entry.userLabel ?? entry.label;
  const displayKind = entry.userKind ?? entry.kind;
  const isHidden = entry.hidden ?? false;
  const isRemoved = isHidden && !entry.userKind;

  return (
    <div
      className={`rounded-lg border bg-zinc-900 p-3 transition-colors ${
        isHidden
          ? 'border-zinc-800/50 opacity-50'
          : 'border-zinc-800'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Kind toggle */}
        <button
          type="button"
          onClick={() =>
            onUpdate(entry.filename, {
              userKind: displayKind === 'agent' ? 'workflow' : 'agent',
            })
          }
          className="flex-shrink-0 p-1.5 rounded-md hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200"
          title={`Currently: ${displayKind}. Click to toggle.`}
        >
          {displayKind === 'agent' ? (
            <BotIcon className="size-4" />
          ) : (
            <WorkflowIcon className="size-4" />
          )}
        </button>

        {/* Label input + filename */}
        <div className="flex-1 min-w-0">
          <Input
            value={displayLabel}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onUpdate(entry.filename, { userLabel: e.target.value })
            }
            className="h-7 bg-zinc-900 border-zinc-800 font-mono text-xs text-zinc-200 focus-visible:border-zinc-600"
          />
          <p className="font-mono text-[10px] text-zinc-600 mt-0.5 truncate">
            {entry.filename}
            {entry.cronExpression && (
              <span className="ml-2 text-zinc-500">
                cron: {entry.cronExpression}
              </span>
            )}
          </p>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isRemoved && (
            <Badge variant="destructive" className="text-[10px] font-mono">
              removed
            </Badge>
          )}
          <Badge variant="secondary" className="text-[10px] font-mono">
            {displayKind}
          </Badge>
        </div>

        {/* Confidence/signals tooltip */}
        <Tooltip>
          <TooltipTrigger className="flex-shrink-0 p-1 text-zinc-500 hover:text-zinc-300 transition-colors">
            <InfoIcon className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            <div className="text-xs font-mono">
              <p>Confidence: {Math.round(entry.confidence * 100)}%</p>
              {entry.signals.length > 0 && (
                <p className="mt-1">
                  Signals: {entry.signals.join(', ')}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Visibility toggle */}
        <button
          type="button"
          onClick={() =>
            onUpdate(entry.filename, { hidden: !isHidden })
          }
          className="flex-shrink-0 p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
          title={isHidden ? 'Show workflow' : 'Hide workflow'}
        >
          {isHidden ? (
            <EyeOffIcon className="size-3.5" />
          ) : (
            <EyeIcon className="size-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
