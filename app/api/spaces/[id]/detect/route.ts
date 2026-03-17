import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, spaces } from '@/lib/db/schema';
import { decrypt } from '@/lib/encrypt';
import { fetchWorkflowFiles, fetchFileContent } from '@/lib/github';
import { detectWorkflows } from '@/lib/detect-workflows';
import { eq, and } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { parse as parseYaml } from 'yaml';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { repo } = await req.json() as { repo: string };

  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const token = decrypt(user.github_token_enc);

  // Fetch and parse all workflow files
  const files = await fetchWorkflowFiles(repo, token);
  const ymlFiles = files.filter((f) => f.name.endsWith('.yml') || f.name.endsWith('.yaml'));

  const workflowMetas = await Promise.all(
    ymlFiles.map(async (f) => {
      const content = await fetchFileContent(repo, f.path, token);
      const parsed = parseYaml(content) as Record<string, unknown>;
      const onTriggers = parsed['on'] ?? {};
      const triggerTypes = typeof onTriggers === 'object' && onTriggers !== null
        ? Object.keys(onTriggers)
        : [];
      const cronExpression = (
        (onTriggers as Record<string, unknown>)?.schedule as Array<{ cron?: string }> | undefined
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
  return NextResponse.json(results);
}
