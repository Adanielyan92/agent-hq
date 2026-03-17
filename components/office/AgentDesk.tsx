'use client';
import { useMemo } from 'react';
import type { AgentStatus, AgentRoleKey } from '@/lib/types';
import { AGENT_ROLES } from '@/config/agent-roles';
import { AgentSprite } from './AgentSprite';
import { formatDistanceToNow, parseISO } from 'date-fns';

const ROLE_COLORS: Record<string, string> = {
  orchestrator: '#a78bfa',
  implementer:  '#60a5fa',
  reviewer:     '#fbbf24',
  ci_runner:    '#34d399',
  board_sync:   '#94a3b8',
  pipeline:     '#f472b6',
};

const MONITOR_CONFIGS: Record<
  AgentStatus['state'],
  { screen: string; glow: string }
> = {
  working:  { screen: '#0c2d3f', glow: '#22d3ee' },
  queued:   { screen: '#2a1505', glow: '#fb923c' },
  success:  { screen: '#052e16', glow: '#4ade80' },
  failed:   { screen: '#2d0707', glow: '#f87171' },
  sleeping: { screen: '#1e1b4b', glow: '#818cf8' },
  idle:     { screen: '#09090b', glow: 'transparent' },
};

const STATE_LABELS: Record<AgentStatus['state'], string> = {
  working:  'Working',
  queued:   'Queued',
  success:  'Done',
  failed:   'Failed',
  sleeping: 'Sleeping',
  idle:     'Idle',
};

// ── Derive a short human-readable action from logs/step name ─────────
function parseLastAction(
  logSnippet: string | null,
  currentStep: string | null
): string | null {
  // Map GitHub step names to friendly labels
  if (currentStep) {
    const s = currentStep.toLowerCase();
    if (s.includes('claude') || s.includes('agent'))      return '🤖 Claude running';
    if (s.includes('checkout'))                            return '📦 Checking out';
    if (s.includes('install') || s.includes('setup'))     return '📦 Setting up';
    if (s.includes('test'))                                return '🧪 Running tests';
    if (s.includes('build'))                               return '🔨 Building';
    if (s.includes('lint') || s.includes('check'))        return '🔍 Linting';
    if (s.includes('deploy'))                              return '🚀 Deploying';
  }

  if (!logSnippet) return null;

  const lines = logSnippet
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 2 && !l.startsWith('##'));

  for (const line of [...lines].reverse()) {
    const l = line.toLowerCase();
    if (l.includes('write_file') || l.includes('writing'))      return '✏️ Writing file';
    if (l.includes('read_file')  || l.includes('reading'))      return '📖 Reading file';
    if (l.includes('edit_file')  || l.includes('editing'))      return '✏️ Editing file';
    if (l.includes('bash')       || l.includes('executing'))    return '⚡ Running cmd';
    if (l.includes('search')     || l.includes('grep'))         return '🔍 Searching';
    if (l.includes('git commit')                              )  return '📝 Committing';
    if (l.includes('create_file'))                              return '📄 New file';
    if (l.includes('test')       || l.includes('spec'))         return '🧪 Testing';
    if (l.includes('error')      || l.includes('failed'))       return '⚠️ Error hit';
    if (l.includes('done')       || l.includes('success'))      return '✅ Wrapping up';
    // Short, non-path lines are likely human-readable Claude output
    if (line.length > 4 && line.length < 32 &&
        !line.includes('/home/') && !line.includes('/usr/') &&
        !line.includes('http')) {
      return line.slice(0, 30);
    }
  }
  return null;
}

// ── Visitor = another agent who is currently at this desk ───────────
export interface DeskVisitor {
  role: AgentRoleKey;
  label: string;  // "peer review" | "delegating task" | "running checks"
  fromRight: boolean; // which side they walked in from
}

interface Props {
  agent: AgentStatus;
  visitor?: DeskVisitor | null;
  isAway?: boolean;  // this agent is currently visiting another desk
}

export function AgentDesk({ agent, visitor, isAway }: Props) {
  const role    = AGENT_ROLES[agent.role];
  const color   = ROLE_COLORS[agent.role] ?? '#94a3b8';
  const monitor = MONITOR_CONFIGS[agent.state];

  const subtitle =
    agent.state === 'sleeping' && agent.nextCronAt
      ? `Next: ${formatDistanceToNow(parseISO(agent.nextCronAt))}`
      : agent.currentStep
      ? agent.currentStep.slice(0, 24)
      : agent.runName
      ? agent.runName.slice(0, 24)
      : null;

  const stepPct = agent.stepTotal && agent.stepCurrent
    ? Math.round((agent.stepCurrent / agent.stepTotal) * 100)
    : null;

  const lastAction = useMemo(
    () => parseLastAction(agent.logSnippet, agent.currentStep),
    [agent.logSnippet, agent.currentStep]
  );

  // Visitor character details
  const visitorConfig = visitor ? AGENT_ROLES[visitor.role] : null;
  const visitorColor  = visitor ? (ROLE_COLORS[visitor.role] ?? '#94a3b8') : null;

  const rootClass = [
    'agent-desk',
    `agent-desk-${agent.state}`,
    isAway ? 'desk-is-away' : '',
    visitor ? 'desk-has-visitor' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>

      {/* ── Sub-agent badge ── */}
      {agent.triggeredByBot && (
        <div className="sub-agent-badge" title={`Triggered by ${agent.triggeredBy ?? 'bot'}`}>
          ⚡ sub
        </div>
      )}

      {/* ── Visiting agent walks in ── */}
      {visitor && visitorConfig && visitorColor && (
        <div className={`desk-visitor ${visitor.fromRight ? 'visitor-from-right' : 'visitor-from-left'}`}>
          <AgentSprite
            sprite={visitorConfig.sprite}
            state="working"
            color={visitorColor}
          />
          <span className="visitor-label">{visitor.label}</span>
        </div>
      )}

      {/* ── Away indicator on this agent's own desk ── */}
      {isAway && (
        <div className="away-badge">away</div>
      )}

      {/* ── Character ── */}
      <div className="agent-figure">
        {/* Thought bubble — shows what Claude is currently doing */}
        {agent.state === 'working' && lastAction && (
          <div className="thought-bubble">{lastAction}</div>
        )}
        <AgentSprite sprite={role.sprite} state={isAway ? 'idle' : agent.state} color={color} />
      </div>

      {/* ── Desk workstation ── */}
      <div
        className="desk-surface"
        style={{
          '--monitor-screen': monitor.screen,
          '--monitor-glow':   monitor.glow,
        } as React.CSSProperties}
      >
        {/* Monitor */}
        <div className="desk-monitor">
          <div className="monitor-screen">
            {agent.state === 'working' && (
              <div className="monitor-typing-lines">
                <div className="typing-line" />
                <div className="typing-line" />
                <div className="typing-line" />
              </div>
            )}
            {agent.state === 'failed' && (
              <div className="monitor-error-icon">✕</div>
            )}
            {agent.state === 'success' && (
              <div className="monitor-success-icon">✓</div>
            )}
            {agent.state === 'idle' && (
              <div className="monitor-idle-lines">
                <div className="idle-line" />
                <div className="idle-line" />
                <div className="idle-line" />
              </div>
            )}
            {agent.state === 'sleeping' && (
              <div className="monitor-sleep-screen" />
            )}
          </div>
          <div className="monitor-stand" />
          <div className="monitor-base" />
        </div>

        {/* Keyboard */}
        <div className="desk-keyboard" />

        {/* Mouse */}
        <div className="desk-mouse" />
      </div>

      {/* ── Step progress bar (working only) ── */}
      {agent.state === 'working' && stepPct !== null && (
        <div className="step-progress-bar">
          <div
            className="step-progress-fill"
            style={{
              width: `${stepPct}%`,
              background: monitor.glow,
            }}
          />
          <span className="step-progress-label">
            {agent.stepCurrent}/{agent.stepTotal}
          </span>
        </div>
      )}

      {/* ── Nameplate ── */}
      <div className="desk-nameplate">
        <div className="nameplate-role">{role.label}</div>
        {agent.runUrl ? (
          <a
            href={agent.runUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`nameplate-status nameplate-${agent.state}`}
          >
            {STATE_LABELS[agent.state]}
          </a>
        ) : (
          <div className={`nameplate-status nameplate-${agent.state}`}>
            {STATE_LABELS[agent.state]}
          </div>
        )}
        {subtitle && (
          <div className="nameplate-subtitle" title={subtitle}>{subtitle}</div>
        )}
        {agent.event && agent.state !== 'idle' && agent.state !== 'sleeping' && (
          <div className="nameplate-event">on: {agent.event}</div>
        )}
      </div>

      {/* ── Live log terminal (working agents only) ── */}
      {agent.state === 'working' && (
        <div className="agent-terminal">
          <div className="terminal-header">
            <span className="terminal-dot terminal-dot-red" />
            <span className="terminal-dot terminal-dot-yellow" />
            <span className="terminal-dot terminal-dot-green" />
            <span className="terminal-title">
              {agent.currentStep ? agent.currentStep.slice(0, 22) : 'running…'}
            </span>
          </div>
          <div className="terminal-body">
            {agent.logSnippet ? (
              agent.logSnippet.split('\n').slice(-6).map((line, i) => (
                <div key={i} className="terminal-line">{line.slice(0, 44)}</div>
              ))
            ) : (
              <div className="terminal-line terminal-waiting">
                <span className="terminal-cursor" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
