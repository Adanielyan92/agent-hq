'use client';

import { useEffect, useRef, useState } from 'react';
import type { GameAssets } from '@/lib/game-engine/assetLoader';
import { loadGameAssets } from '@/lib/game-engine/assetLoader';
import { OfficeState } from '@/lib/game-engine/officeState';
import { renderFrame } from '@/lib/game-engine/renderer';
import { MAX_DELTA_TIME_SEC, TILE_SIZE } from '@/lib/game-engine/types';
import type { LoungeMode } from '@/lib/game-engine/types';
import type { AgentStatus } from '@/lib/types';
import { createAgentHqLayout } from '@/lib/game-engine/agentHqLayout';
import { createAgentHqLayoutLarge, LOUNGE_TILES_LARGE } from '@/lib/game-engine/agentHqLayoutLarge';

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
  // Maps agent ID (filename) → character index in game engine
  const agentMapRef  = useRef<Map<string, number>>(new Map());
  // Counter for assigning new character indices
  const nextIndexRef = useRef(0);
  // Track previous active states so we only trigger walks on changes
  const prevActiveRef = useRef<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Flipped to true once OfficeState has been created (deferred until first agent data)
  const [engineReady, setEngineReady] = useState(false);

  // ── Load assets on mount ───────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    loadGameAssets().then((assets) => {
      if (cancelled) return;
      assetsRef.current = assets;
      setLoading(false);
    }).catch((err: unknown) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : String(err));
    });
    return () => { cancelled = true; };
  }, []);

  // ── Sync agent status → game state ──────────────────────────
  useEffect(() => {
    // Wait until assets are loaded
    if (loading || error) return;

    // Skip sync when no agent data has arrived yet
    if (agents.length === 0) return;

    // Lazily create OfficeState on first agent arrival (layout chosen once)
    if (!stateRef.current) {
      const useLarge = agents.length > 6;
      const layout = useLarge ? createAgentHqLayoutLarge() : createAgentHqLayout();
      const loungeTiles = useLarge ? LOUNGE_TILES_LARGE : undefined;
      stateRef.current = new OfficeState(layout, loungeTiles);
      setEngineReady(true);
    }
    const state = stateRef.current;

    const agentMap = agentMapRef.current;
    const currentIds = new Set(agents.map(a => a.id));
    const isFirstSync = Object.keys(prevActiveRef.current).length === 0;

    // Remove agents that are no longer in props
    for (const [id, index] of agentMap) {
      if (!currentIds.has(id)) {
        state.removeAgent(index);
        agentMap.delete(id);
        delete prevActiveRef.current[id];
      }
    }

    // Add new agents and update existing ones
    for (const agent of agents) {
      let index = agentMap.get(agent.id);

      if (index === undefined) {
        // New agent — create in game engine
        index = nextIndexRef.current++;
        state.addAgent(index, index % 6, agent.label);
        agentMap.set(agent.id, index);

        // Determine initial state
        const isActive = agent.state === 'working' || agent.state === 'queued'
                      || agent.state === 'success' || agent.state === 'failed';
        const tool = agent.state === 'success' ? 'Read' : (agent.currentStep ?? null);
        state.setAgentActive(index, isActive, tool);

        const loungeMode: LoungeMode =
          agent.state === 'coffee' ? 'coffee' :
          agent.state === 'sleeping' ? 'sleeping' : 'idle';
        state.setLoungeMode(index, loungeMode);

        if (isActive) {
          state.sendToSeat(index);
        } else {
          state.sendToLounge(index);
        }

        prevActiveRef.current[agent.id] = isActive;
        continue;
      }

      // Existing agent — update state
      const isActive = agent.state === 'working' || agent.state === 'queued'
                    || agent.state === 'success' || agent.state === 'failed';
      const tool = agent.state === 'success' ? 'Read' : (agent.currentStep ?? null);
      const wasActive = prevActiveRef.current[agent.id] ?? false;

      state.setAgentActive(index, isActive, tool);

      const loungeMode: LoungeMode =
        agent.state === 'coffee' ? 'coffee' :
        agent.state === 'sleeping' ? 'sleeping' : 'idle';
      state.setLoungeMode(index, loungeMode);

      if (isActive && !wasActive) {
        // Just became active — walk to own desk
        state.sendToSeat(index);
      } else if ((wasActive && !isActive) || (isFirstSync && !isActive)) {
        // Just became idle, or first load with agent idle — teleport to lounge
        state.sendToLounge(index);
      }

      prevActiveRef.current[agent.id] = isActive;
    }
  }, [agents, loading, error]);

  // ── Game loop ────────────────────────────────────────────────
  useEffect(() => {
    if (loading || error || !engineReady) return;

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
  }, [loading, error, engineReady]);

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
            Loading sprites...
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
