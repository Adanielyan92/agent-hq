import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { spaces } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { share_enabled } = await req.json() as { share_enabled: boolean };

  const [updated] = await db
    .update(spaces)
    .set({ share_enabled })
    .where(and(eq(spaces.id, id), eq(spaces.owner_id, session.user.id)))
    .returning();

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ share_enabled: updated.share_enabled, share_token: updated.share_token });
}
