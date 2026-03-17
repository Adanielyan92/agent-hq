import { db } from '@/lib/db';
import { spaces } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { OfficeFloor } from '@/components/office/OfficeFloor';
import { ShareBadge } from '@/components/layout/ShareBadge';

export default async function SharePage({ params }: { params: Promise<{ share_token: string }> }) {
  const { share_token } = await params;

  const space = await db.query.spaces.findFirst({
    where: and(eq(spaces.share_token, share_token), eq(spaces.share_enabled, true)),
  });
  if (!space) notFound();

  return (
    <main className="max-w-5xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-mono">{space.name}</h1>
          <p className="font-mono text-xs text-zinc-500 mt-1">{space.repo_full_name}</p>
        </div>
        <ShareBadge />
      </div>
      {/* Pass spaceId + shareToken so client polls with ?token= (no auth required) */}
      <OfficeFloor spaceId={space.id} shareToken={space.share_token} readOnly />
    </main>
  );
}
