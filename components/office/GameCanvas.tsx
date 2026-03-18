'use client';

import { useEffect, useRef, useState } from 'react';
import type { GameAssets } from '@/lib/game-engine/assetLoader';
import { loadGameAssets } from '@/lib/game-engine/assetLoader';
import { OfficeState } from '@/lib/game-engine/officeState';
import { renderFrame } from '@/lib/game-engine/renderer';
import { MAX_DELTA_TIME_SEC, TILE_SIZE } from '@/lib/game-engine/types';
import type { AgentStatus } from '@/lib/types';

/** Role → seat/palette index (matches AGENT_SEAT_INDEX) */
const ROLES = [
  'orchestrator',
  'implementer',
  'reviewer',
  'ci_runner',
  'board_sync',
  'pipeline',
] as const;

interface Props {
  agents: AgentStatus[];
}

export function GameCanvas({ agents }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const stateRef     = useRef<OfficeState | null>(null);
  const assetsRef    = useRef<GameAssets | null>(null);
  const rafRef       = useRef<number>(0);
  const lastTimeRef  = useRef<number>(0);
  const zoomRef      = useRef<number>(3);
  // Track previous active states so we only trigger walks on changes
  const prevActiveRef = useRef<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Initialize engine on mount ──────────────────────────────
  useEffect(() => {
    let cancelled = false;
    loadGameAssets().then((assets) => {
      if (cancelled) return;
      assetsRef.current = assets;

      const state = new OfficeState();
      stateRef.current = state;

      ROLES.forEach((role, i) => {
        state.addAgent(i, i, role.replace('_', ' '));
      });

      setLoading(false);
    }).catch((err: unknown) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : String(err));
    });
    return () => { cancelled = true; };
  }, []);

  // ── Sync agent status → game state ──────────────────────────
  useEffect(() => {
    // Wait until assets are loaded and game state is initialized
    if (loading || error) return;
    const state = stateRef.current;
    if (!state) return;

    // Skip sync when no agent data has arrived yet — agents start at their
    // desks (from addAgent) and should stay there until we know their real status.
    if (agents.length === 0) return;

    const byRole = new Map(agents.map((a) => [a.role, a]));
    const isFirstSync = Object.keys(prevActiveRef.current).length === 0;

    ROLES.forEach((role, i) => {
      const agent = byRole.get(role);
      const isActive = agent?.state === 'working' || agent?.state === 'queued';
      const tool = agent?.currentStep ?? null;
      const wasActive = prevActiveRef.current[role] ?? false;

      state.setAgentActive(i, isActive, tool);

      if (isActive && !wasActive) {
        // Just became active → walk to own desk
        state.sendToSeat(i);
      } else if ((wasActive && !isActive) || (isFirstSync && !isActive)) {
        // Just became idle, or first load with agent idle → teleport to lounge
        state.sendToLounge(i);
      }
    });

    // Update previous active state tracking
    ROLES.forEach((role) => {
      const agent = byRole.get(role);
      prevActiveRef.current[role] = agent?.state === 'working' || agent?.state === 'queued';
    });
  }, [agents, loading, error]);

  // ── Game loop ────────────────────────────────────────────────
  useEffect(() => {
    if (loading || error) return;

    const canvas = canvasRef.current;
    const state  = stateRef.current;
    const assets = assetsRef.current;
    if (!canvas || !state || !assets) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const dpr   = window.devicePixelRatio || 1;
    const MAP_W = state.layout.cols * TILE_SIZE;
    const MAP_H = state.layout.rows * TILE_SIZE;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      canvas.width  = rect.width  * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width  = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.imageSmoothingEnabled = false;
      zoomRef.current = Math.min(3 * dpr, canvas.width / MAP_W, canvas.height / MAP_H);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);

    const loop = (timestamp: number) => {
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, MAX_DELTA_TIME_SEC);
      lastTimeRef.current = timestamp;
      state.update(dt);
      renderFrame(ctx, canvas.width, canvas.height,
        state.layout, state.furnitureInstances, state.getCharacters(), assets, zoomRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };

    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [loading, error]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="font-mono text-xs text-red-400">Failed to load sprites: {error}</p>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-1.5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-bounce"
                style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
          <p className="font-mono text-[10px] text-zinc-600 tracking-widest uppercase">
            Loading sprites…
          </p>
        </div>
      </div>
    );
  }

  return (
    <canvas ref={canvasRef} className="block w-full h-full"
      style={{ imageRendering: 'pixelated' }} />
  );
}
