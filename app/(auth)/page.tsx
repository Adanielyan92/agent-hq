import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SignInButton } from '@/components/auth/SignInButton';

export default async function LandingPage() {
  const session = await auth();
  if (session) redirect('/dashboard');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Agent HQ</h1>
      <p className="text-zinc-400 text-center max-w-md">
        Watch your GitHub Actions CI agents work in real time — as animated
        pixel-art characters in a top-down office.
      </p>
      <SignInButton />
    </main>
  );
}
