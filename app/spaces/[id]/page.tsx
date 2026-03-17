import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { spaces } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { OfficeFloor } from '@/components/office/OfficeFloor';
import { ShareToggle } from '@/components/layout/ShareBadge';
import { Header } from '@/components/layout/Header';

export default async function SpacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const space = await db.query.spaces.findFirst({
    where: and(eq(spaces.id, id), eq(spaces.owner_id, session.user.id)),
  });
  if (!space) notFound();

  return (
    <>
      <Header />
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold font-mono text-zinc-100 tracking-tight">{space.name}</h1>
            <p className="font-mono text-[11px] text-zinc-600 mt-0.5 tracking-wider">{space.repo_full_name}</p>
          </div>
          <ShareToggle
            spaceId={space.id}
            shareEnabled={space.share_enabled}
            shareToken={space.share_token}
          />
        </div>
        <OfficeFloor spaceId={space.id} />
      </main>
    </>
  );
}
