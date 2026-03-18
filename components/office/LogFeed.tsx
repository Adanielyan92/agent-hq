'use client';
import { useMemo, useEffect, useRef } from 'react';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import type { AgentStatus, AgentJobStep, AgentRoleKey } from '@/lib/types';
import { AGENT_ROLES } from '@/config/agent-roles';

const ROLE_COLORS: Record<string, string> = {
  orchestrator: '#a78bfa',
  implementer:  '#60a5fa',
  reviewer:     '#fbbf24',
  ci_runner:    '#34d399',
  board_sync:   '#94a3b8',
  pipeline:     '#f472b6',
};

// ── Color a raw log line ──────────────────────────────────────────────
function lineColor(text: string): string {
  const l = text.toLowerCase();
  if (/error|failed|fatal|exception/i.test(l))                     return '#f87171';
  if (/success|passed|done|complete|✓|✅/i.test(l))                 return '#4ade80';
  if (/warn(?:ing)?/i.test(l))                                      return '#fbbf24';
  if (/write_file|edit_file|create_file|bash|tool_use|tool_result/i.test(l)) return '#38bdf8';
  if (/read_file|reading|fetching|search|grep|glob/i.test(l))       return '#818cf8';
  if (/git\s|commit|push|pull|checkout/i.test(l))                   return '#c084fc';
  if (/test|spec|assert|expect/i.test(l))                           return '#fb923c';
  if (/deploy|build|install|npm|pnpm|yarn/i.test(l))                return '#f0abfc';
  if (/claude|agent|model|anthropic/i.test(l))                      return '#22d3ee';
  return '#4b5563';
}

// ── Step icon + color ─────────────────────────────────────────────────
function stepIcon(step: AgentJobStep): { icon: string; color: string } {
  if (step.status === 'in_progress') return { icon: '●', color: '#22d3ee' };
  if (step.status === 'queued')      return { icon: '○', color: '#374151' };
  if (step.conclusion === 'success') return { icon: '✓', color: '#4ade80' };
  if (step.conclusion === 'failure') return { icon: '✕', color: '#f87171' };
  if (step.conclusion === 'skipped') return { icon: '–', color: '#374151' };
  return { icon: '○', color: '#374151' };
}

function elapsed(startedAt: string | null, completedAt: string | null): string | null {
  if (!startedAt) return null;
  try {
    const start = parseISO(startedAt).getTime();
    const end   = completedAt ? parseISO(completedAt).getTime() : Date.now();
    const ms    = end - start;
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
    return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
  } catch {
    return null;
  }
}

// ── Step timeline ─────────────────────────────────────────────────────
function StepTimeline({ steps }: { steps: AgentJobStep[] }) {
  if (steps.length === 0) return null;
  return (
    <div className="step-timeline">
      {steps.map((step, i) => {
        const { icon, color } = stepIcon(step);
        const time = elapsed(step.startedAt, step.completedAt);
        const isActive = step.status === 'in_progress';
        return (
          <div key={i} className={`step-row ${isActive ? 'step-row-active' : ''}`}>
            <span className="step-icon" style={{ color }}>{icon}</span>
            <span className="step-name" style={{ color: isActive ? '#e2e8f0' : undefined }}>
              {step.name}
            </span>
            {time && <span className="step-time">{time}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── Raw log lines ─────────────────────────────────────────────────────
function LogLines({ snippet }: { snippet: string }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const lines = snippet.split('\n').filter(l => l.trim().length > 1).slice(-10);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [snippet]);

  return (
    <div className="log-raw" ref={bodyRef}>
      {lines.map((line, i) => (
        <div key={i} className="log-ln">
          <span className="log-ln-pfx">›</span>
          <span style={{ color: lineColor(line) }}>{line.slice(0, 100)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Single agent panel ────────────────────────────────────────────────
function AgentLogPanel({ agent }: { agent: AgentStatus }) {
  const color    = ROLE_COLORS[agent.role] ?? '#94a3b8';
  const label    = AGENT_ROLES[agent.role]?.label ?? agent.role;
  const isActive = agent.state === 'working';

  // Duration the job has been running
  let runDuration: string | null = null;
  if (agent.startedAt) {
    try {
      runDuration = formatDistanceToNowStrict(parseISO(agent.startedAt));
    } catch { /* ignore */ }
  }

  return (
    <div className="log-panel" style={{ '--role-color': color } as React.CSSProperties}>

      {/* ── Header ── */}
      <div className="log-panel-hdr">
        <span className="log-panel-role-dot" />
        <span className="log-panel-role-name">{label}</span>
        {agent.currentStep && (
          <span className="log-panel-step">{agent.currentStep.slice(0, 32)}</span>
        )}
        <span className="log-panel-spacer" />
        {runDuration && isActive && (
          <span className="log-duration">{runDuration}</span>
        )}
        {isActive && <span className="log-live-badge">● live</span>}
        {agent.runUrl && (
          <a
            href={agent.runUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="log-gh-link"
            title="Open run in GitHub"
          >↗</a>
        )}
      </div>

      {/* ── Content: step timeline (always) + raw log (when available) ── */}
      <div className="log-panel-content">
        {agent.jobSteps.length > 0
          ? <StepTimeline steps={agent.jobSteps} />
          : !agent.logSnippet && (
            <div className="log-ln log-ln-waiting">
              <span className="log-cursor" />
              <span>waiting for steps…</span>
            </div>
          )
        }

        {agent.logSnippet && <LogLines snippet={agent.logSnippet} />}
      </div>

      {/* ── Footer: event + step count ── */}
      {(agent.event || agent.stepTotal) && (
        <div className="log-panel-footer">
          {agent.event && (
            <span className="log-event">on: {agent.event.replace(/_/g, ' ')}</span>
          )}
          {agent.stepCurrent != null && agent.stepTotal != null && (
            <span className="log-step-count">{agent.stepCurrent}/{agent.stepTotal} steps</span>
          )}
          {agent.triggeredBy && (
            <span className="log-trigger">by {agent.triggeredBy}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────
export function LogFeed({ agents }: { agents: AgentStatus[] }) {
  const visibleAgents = useMemo(() => {
    return agents.filter(a =>
      a.state === 'working' ||
      a.state === 'queued'  ||
      (a.logSnippet && a.state !== 'idle')
    );
  }, [agents]);

  if (visibleAgents.length === 0) return null;

  const activeCount = visibleAgents.filter(a => a.state === 'working').length;

  return (
    <div className="log-feed">
      <div className="log-feed-bar">
        <span className="log-feed-title">
          Live Output
          {activeCount > 0 && (
            <span className="log-active-count">{activeCount} running</span>
          )}
        </span>
        <div className="log-feed-indicators">
          {visibleAgents.map(a => (
            <span
              key={a.role}
              className={`log-indicator ${a.state === 'working' ? 'log-indicator-live' : ''}`}
              style={{ background: ROLE_COLORS[a.role] ?? '#374151' }}
              title={AGENT_ROLES[a.role]?.label ?? a.role}
            />
          ))}
        </div>
      </div>

      <div className="log-feed-grid">
        {visibleAgents.map(agent => (
          <AgentLogPanel key={agent.role} agent={agent} />
        ))}
      </div>
    </div>
  );
}
