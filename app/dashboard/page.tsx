import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { spaces } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { SpaceCard } from '@/components/spaces/SpaceCard';

export default async function DashboardPage() {
  const session = await auth();
  const userSpaces = await db.query.spaces.findMany({
    where: eq(spaces.owner_id, session!.user.id),
    orderBy: (s, { desc }) => [desc(s.created_at)],
  });

  return (
    <main className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold font-mono">Your Spaces</h1>
        <Link href="/dashboard/spaces/new" className={buttonVariants()}>+ New Space</Link>
      </div>
      {userSpaces.length === 0 ? (
        <p className="text-zinc-400 font-mono">No spaces yet. Connect a GitHub repo to get started.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {userSpaces.map((space) => (
            <SpaceCard key={space.id} space={space} />
          ))}
        </div>
      )}
    </main>
  );
}
