import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { encrypt } from '@/lib/encrypt';

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [GitHub({
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    authorization: {
      params: { scope: 'read:user user:email repo' },
    },
  })],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'github' && account.access_token && user.id) {
        await db
          .insert(users)
          .values({
            id:               user.id,
            username:         user.name ?? user.email ?? 'unknown',
            avatar_url:       user.image ?? null,
            github_token_enc: encrypt(account.access_token),
          })
          .onConflictDoUpdate({
            target: users.id,
            set: {
              github_token_enc: encrypt(account.access_token),
              username: user.name ?? user.email ?? 'unknown',
              avatar_url: user.image ?? null,
            },
          });
      }
      return true;
    },
    async jwt({ token, user }) {
      // Ensure token.sub is always the GitHub profile ID, not a generated UUID
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

// Extend the session type to include id
declare module 'next-auth' {
  interface Session {
    user: { id: string; name?: string | null; email?: string | null; image?: string | null };
  }
}
