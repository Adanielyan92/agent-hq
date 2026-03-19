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

  // First pass: score every workflow for every role and pick primary matches.
  const roleScored = roles.map((role) => {
    const detect = AGENT_ROLES[role].autoDetect;
    const scored = workflows
      .map((wf) => ({ wf, score: scoreWorkflow(wf, detect) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);
    return { role, scored };
  });

  // Collect filenames that are the primary (best) match for at least one role.
  // These should NOT be auto-included as additional filenames for other roles.
  const primaryFilenames = new Set<string>();
  for (const { scored } of roleScored) {
    if (scored[0]) primaryFilenames.add(`${scored[0].wf.filename}.yml`);
  }

  // Second pass: build results, attaching additional filenames for unassigned
  // workflows that scored well enough (≥ 2 = at least a trigger-type match).
  return roleScored.map(({ role, scored }) => {
    const best = scored[0];
    if (!best) {
      return { role, matched: null, confidence: 'undetected', score: 0, alternatives: [] };
    }

    // Unassigned alternatives: workflows that aren't primary for any role
    const additionalFilenames = scored.slice(1)
      .filter((s) => s.score >= 2 && !primaryFilenames.has(`${s.wf.filename}.yml`))
      .map((s) => `${s.wf.filename}.yml`);

    const matched: WorkflowConfigEntry = {
      filename: `${best.wf.filename}.yml`,
      ...(best.wf.cronExpression ? { cronExpression: best.wf.cronExpression } : {}),
      ...(additionalFilenames.length > 0 ? { additionalFilenames } : {}),
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
