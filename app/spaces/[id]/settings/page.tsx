import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { spaces } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { WorkflowSettings } from './WorkflowSettings';
import Link from 'next/link';
import { ArrowLeftIcon } from 'lucide-react';

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
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
      <main className="max-w-2xl mx-auto px-4 py-6">
        <Link href={`/spaces/${space.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors font-mono mb-6">
          <ArrowLeftIcon className="size-3.5" />
          Back to {space.name}
        </Link>
        <h1 className="text-xl font-bold font-mono text-zinc-100 mb-1">Settings</h1>
        <p className="font-mono text-[11px] text-zinc-600 mb-6">{space.repo_full_name}</p>
        <WorkflowSettings
          spaceId={space.id}
          repoFullName={space.repo_full_name}
          initialEntries={Array.isArray(space.workflow_config) ? space.workflow_config as any : []}
        />
      </main>
    </>
  );
}
