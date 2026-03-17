import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { spaces } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { OfficeFloor } from '@/components/office/OfficeFloor';
import { ShareToggle } from '@/components/layout/ShareBadge';

export default async function SpacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const space = await db.query.spaces.findFirst({
    where: and(eq(spaces.id, id), eq(spaces.owner_id, session!.user.id)),
  });
  if (!space) notFound();

  return (
    <main className="max-w-5xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-mono">{space.name}</h1>
          <p className="font-mono text-xs text-zinc-500 mt-1">{space.repo_full_name}</p>
        </div>
        <ShareToggle
          spaceId={space.id}
          shareEnabled={space.share_enabled}
          shareToken={space.share_token}
        />
      </div>
      <OfficeFloor spaceId={space.id} />
    </main>
  );
}
