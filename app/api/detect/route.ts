import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { decrypt } from '@/lib/encrypt';
import { fetchWorkflowFiles, fetchFileContent } from '@/lib/github';
import { classifyWorkflows } from '@/lib/classify-workflows';
import type { WorkflowMeta } from '@/lib/classify-workflows';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { parse as parseYaml } from 'yaml';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { repo } = await req.json() as { repo: string };

  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const token = decrypt(user.github_token_enc);

  let files: Awaited<ReturnType<typeof fetchWorkflowFiles>>;
  try {
    files = await fetchWorkflowFiles(repo, token);
  } catch {
    // No .github/workflows directory — return empty detections
    return NextResponse.json(classifyWorkflows([]));
  }

  const ymlFiles = files.filter((f) => f.name.endsWith('.yml') || f.name.endsWith('.yaml'));

  const workflowMetas = await Promise.all(
    ymlFiles.map(async (f): Promise<WorkflowMeta> => {
      const content = await fetchFileContent(repo, f.path, token);

      let parsed: Record<string, unknown>;
      try {
        parsed = parseYaml(content) as Record<string, unknown>;
      } catch {
        return {
          filename: f.name,
          name: f.name,
          triggerTypes: [],
          usesActions: [],
          referencedSecrets: [],
          referencedEnvVars: [],
        };
      }

      const onTriggers = (parsed['on'] ?? {}) as Record<string, unknown>;
      const triggerTypes = Object.keys(onTriggers);

      const cronExpression = (
        onTriggers?.schedule as Array<{ cron?: string }> | undefined
      )?.[0]?.cron;

      // Collect usesActions from all job steps
      const usesActions: string[] = [];
      const jobs = (parsed['jobs'] ?? {}) as Record<string, { steps?: Array<{ uses?: string }>; env?: Record<string, unknown> }>;
      for (const job of Object.values(jobs)) {
        if (job.steps) {
          for (const step of job.steps) {
            if (step.uses) {
              usesActions.push(step.uses);
            }
          }
        }
      }

      // Extract referenced secrets from raw YAML content
      const secretMatches = content.matchAll(/secrets\.(\w+)/g);
      const referencedSecrets = [...new Set([...secretMatches].map(m => m[1]))];

      // Collect env var keys from jobs and steps
      const referencedEnvVars: string[] = [];
      for (const job of Object.values(jobs)) {
        if (job.env) {
          referencedEnvVars.push(...Object.keys(job.env));
        }
        if (job.steps) {
          for (const step of job.steps as Array<{ env?: Record<string, unknown> }>) {
            if (step.env) {
              referencedEnvVars.push(...Object.keys(step.env));
            }
          }
        }
      }

      return {
        filename: f.name,
        name: (parsed['name'] as string) ?? f.name,
        triggerTypes,
        cronExpression,
        usesActions,
        referencedSecrets,
        referencedEnvVars,
      };
    })
  );

  return NextResponse.json(classifyWorkflows(workflowMetas));
}
