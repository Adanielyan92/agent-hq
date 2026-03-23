import type { ClassifiedWorkflow } from '@/lib/types';

export interface WorkflowMeta {
  filename: string;
  name: string;
  triggerTypes: string[];
  cronExpression?: string;
  usesActions: string[];
  referencedSecrets: string[];
  referencedEnvVars: string[];
}

const AI_ACTION_PATTERNS = [
  'anthropic/claude-code-action',
  'github/copilot-',
  'coderabbitai/',
];

const AI_SECRET_PATTERNS: (string | RegExp)[] = [
  'ANTHROPIC_API_KEY', 'OPENAI_API_KEY',
  /^CLAUDE_/i, /^AI_/i,
];

const AI_KEYWORDS = ['claude', 'copilot', 'agent', 'ai', 'gpt', 'llm', 'anthropic', 'openai'];
const CI_KEYWORDS = ['ci', 'test', 'build', 'lint', 'deploy', 'release', 'sync', 'merge', 'check', 'publish'];

interface Signal {
  kind: 'agent' | 'workflow';
  confidence: number;
  reason: string;
}

function collectSignals(wf: WorkflowMeta): Signal[] {
  const signals: Signal[] = [];
  const lowerName = `${wf.name} ${wf.filename}`.toLowerCase();

  for (const action of wf.usesActions) {
    if (AI_ACTION_PATTERNS.some(p => action.toLowerCase().startsWith(p.toLowerCase()))) {
      signals.push({ kind: 'agent', confidence: 0.9, reason: `uses ai action: ${action}` });
    }
  }

  const allRefs = [...wf.referencedSecrets, ...wf.referencedEnvVars];
  for (const ref of allRefs) {
    const matches = AI_SECRET_PATTERNS.some(p =>
      typeof p === 'string' ? ref === p : p.test(ref)
    );
    if (matches) {
      signals.push({ kind: 'agent', confidence: 0.7, reason: `references ai secret: ${ref}` });
    }
  }

  for (const kw of AI_KEYWORDS) {
    if (lowerName.includes(kw)) {
      signals.push({ kind: 'agent', confidence: 0.6, reason: `name contains ai keyword: ${kw}` });
      break;
    }
  }

  for (const kw of CI_KEYWORDS) {
    if (lowerName.includes(kw)) {
      signals.push({ kind: 'workflow', confidence: 0.6, reason: `name contains ci keyword: ${kw}` });
      break;
    }
  }

  if (signals.length === 0) {
    const triggers = wf.triggerTypes;
    if (triggers.includes('issues') || triggers.includes('issue_comment')) {
      signals.push({ kind: 'agent', confidence: 0.3, reason: 'trigger: issues/issue_comment' });
    } else if (triggers.includes('push') || triggers.includes('pull_request')) {
      signals.push({ kind: 'workflow', confidence: 0.3, reason: 'trigger: push/pull_request' });
    }
  }

  return signals;
}

function cleanLabel(filename: string): string {
  return filename
    .replace(/\.(yml|yaml)$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function classifyWorkflows(workflows: WorkflowMeta[]): ClassifiedWorkflow[] {
  return workflows.map(wf => {
    const signals = collectSignals(wf);

    let bestKind: 'agent' | 'workflow' = 'workflow';
    let bestConfidence = 0.2;

    for (const s of signals) {
      if (s.confidence > bestConfidence || (s.confidence === bestConfidence && s.kind === 'agent')) {
        bestKind = s.kind;
        bestConfidence = s.confidence;
      }
    }

    const isFilenameFallback = wf.name === wf.filename || wf.name === '';
    const label = isFilenameFallback ? cleanLabel(wf.filename) : wf.name;

    return {
      filename: wf.filename,
      kind: bestKind,
      label,
      confidence: bestConfidence,
      signals: signals.map(s => s.reason),
      ...(wf.cronExpression ? { cronExpression: wf.cronExpression } : {}),
    };
  });
}
