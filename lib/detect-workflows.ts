import micromatch from 'micromatch';
import type { DetectionResult, AgentRoleKey, WorkflowConfigEntry } from '@/lib/types';
import { AGENT_ROLES } from '@/config/agent-roles';

interface WorkflowMeta {
  filename: string;       // without .yml
  triggerTypes: string[];
  name: string;
  cronExpression?: string;
}

export function scoreWorkflow(
  wf: WorkflowMeta,
  detect: typeof AGENT_ROLES[AgentRoleKey]['autoDetect']
): number {
  let score = 0;
  if (micromatch.isMatch(wf.filename, detect.filenamePatterns)) score += 3;
  if (wf.triggerTypes.some((t) => detect.triggerTypes.includes(t))) score += 2;
  for (const kw of detect.nameKeywords) {
    if (wf.name.toLowerCase().includes(kw)) score += 1;
  }
  return score;
}

export function detectWorkflows(workflows: WorkflowMeta[]): DetectionResult[] {
  const roles = Object.keys(AGENT_ROLES) as AgentRoleKey[];

  return roles.map((role) => {
    const detect = AGENT_ROLES[role].autoDetect;
    const scored = workflows
      .map((wf) => ({ wf, score: scoreWorkflow(wf, detect) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best) {
      return { role, matched: null, confidence: 'undetected', score: 0, alternatives: [] };
    }

    const matched: WorkflowConfigEntry = {
      filename: `${best.wf.filename}.yml`,
      ...(best.wf.cronExpression ? { cronExpression: best.wf.cronExpression } : {}),
    };
    const alternatives = scored.slice(1).map((s) => ({
      filename: `${s.wf.filename}.yml`,
      ...(s.wf.cronExpression ? { cronExpression: s.wf.cronExpression } : {}),
    }));

    return {
      role,
      matched,
      confidence: best.score >= 4 ? 'confident' : 'low',
      score: best.score,
      alternatives,
    };
  });
}
