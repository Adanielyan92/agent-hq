import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { decrypt } from '@/lib/encrypt';
import { fetchUserRepos } from '@/lib/github';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const token = decrypt(user.github_token_enc);
  const repos = await fetchUserRepos(token);
  return NextResponse.json(repos);
}
