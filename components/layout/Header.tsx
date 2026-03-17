import { auth } from '@/lib/auth';
import { signOut } from '@/lib/auth';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

export async function Header() {
  const session = await auth();
  if (!session) return null;

  return (
    <header className="border-b border-zinc-800 bg-zinc-950">
      <div className="max-w-5xl mx-auto px-8 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="font-mono font-bold text-sm text-zinc-100 hover:text-white">
          Agent HQ
        </Link>
        <div className="flex items-center gap-3">
          <Avatar className="h-7 w-7">
            <AvatarImage src={session.user.image ?? ''} />
            <AvatarFallback className="text-xs font-mono">
              {(session.user.name ?? 'U').charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="font-mono text-xs text-zinc-400">{session.user.name}</span>
          <form action={async () => { 'use server'; await signOut(); }}>
            <Button type="submit" variant="ghost" size="sm" className="font-mono text-xs">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
