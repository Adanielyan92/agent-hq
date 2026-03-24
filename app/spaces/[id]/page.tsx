import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { spaces } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { OfficeFloor } from '@/components/office/OfficeFloor';
import { ShareToggle } from '@/components/layout/ShareBadge';
import { Header } from '@/components/layout/Header';
import Link from 'next/link';
import { SettingsIcon } from 'lucide-react';

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
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold font-mono text-zinc-100 tracking-tight">{space.name}</h1>
            <p className="font-mono text-[11px] text-zinc-600 mt-0.5 tracking-wider">{space.repo_full_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/spaces/${space.id}/settings`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-mono text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
              <SettingsIcon className="size-3.5" />
              Settings
            </Link>
            <ShareToggle
              spaceId={space.id}
              shareEnabled={space.share_enabled}
              shareToken={space.share_token}
            />
          </div>
        </div>
        <OfficeFloor spaceId={space.id} />
      </main>
    </>
  );
}
