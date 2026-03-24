import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { spaces } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.workflow_config) updates.workflow_config = body.workflow_config;
  if (body.share_enabled !== undefined) updates.share_enabled = body.share_enabled;

  const [updated] = await db
    .update(spaces)
    .set(updates)
    .where(and(eq(spaces.id, id), eq(spaces.owner_id, session.user.id)))
    .returning();

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}
