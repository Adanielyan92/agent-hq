import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { spaces } from '@/lib/db/schema';
import { NextRequest, NextResponse } from 'next/server';
import type { WorkflowEntry } from '@/lib/types';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, repo_full_name, workflow_config } =
    await req.json() as { name: string; repo_full_name: string; workflow_config: WorkflowEntry[] };

  const [space] = await db
    .insert(spaces)
    .values({ owner_id: session.user.id, name, repo_full_name, workflow_config })
    .returning();

  return NextResponse.json(space, { status: 201 });
}
