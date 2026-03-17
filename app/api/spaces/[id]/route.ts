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
