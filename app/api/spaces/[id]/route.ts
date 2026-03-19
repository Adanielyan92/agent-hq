import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, spaces } from '@/lib/db/schema';
import { decrypt } from '@/lib/encrypt';
import { fetchWorkflowFiles, fetchFileContent } from '@/lib/github';
import { detectWorkflows } from '@/lib/detect-workflows';
import { eq, and } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { parse as parseYaml } from 'yaml';
import type { WorkflowConfig } from '@/lib/types';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await db.delete(spaces).where(
    and(eq(spaces.id, id), eq(spaces.owner_id, session.user.id))
  );
  return new NextResponse(null, { status: 204 });
}

/** Re-detect workflows and update the space's workflow_config. */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const space = await db.query.spaces.findFirst({
    where: and(eq(spaces.id, id), eq(spaces.owner_id, session.user.id)),
  });
  if (!space) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const owner = await db.query.users.findFirst({ where: eq(users.id, space.owner_id) });
  if (!owner) return NextResponse.json({ error: 'Owner not found' }, { status: 500 });

  const token = decrypt(owner.github_token_enc);
  const repo = space.repo_full_name;

  let files: Awaited<ReturnType<typeof fetchWorkflowFiles>>;
  try {
    files = await fetchWorkflowFiles(repo, token);
  } catch {
    return NextResponse.json({ error: 'No workflows found' }, { status: 404 });
  }

  const ymlFiles = files.filter((f) => f.name.endsWith('.yml') || f.name.endsWith('.yaml'));
  const workflowMetas = await Promise.all(
    ymlFiles.map(async (f) => {
      const content = await fetchFileContent(repo, f.path, token);
      const parsed = parseYaml(content) as Record<string, unknown>;
      const onTriggers = (parsed['on'] ?? {}) as Record<string, unknown>;
      const triggerTypes = Object.keys(onTriggers);
      const cronExpression = (
        onTriggers?.schedule as Array<{ cron?: string }> | undefined
      )?.[0]?.cron;
      return {
        filename: f.name.replace(/\.(yml|yaml)$/, ''),
        triggerTypes,
        name: (parsed['name'] as string) ?? f.name,
        cronExpression,
      };
    })
  );

  const results = detectWorkflows(workflowMetas);
  const workflow_config = Object.fromEntries(
    results.map((r) => [r.role, r.matched])
  ) as WorkflowConfig;

  const [updated] = await db
    .update(spaces)
    .set({ workflow_config })
    .where(and(eq(spaces.id, id), eq(spaces.owner_id, session.user.id)))
    .returning();

  return NextResponse.json({ space: updated, detection: results });
}
