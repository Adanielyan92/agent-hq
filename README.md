# Agent HQ

> Watch your GitHub Actions CI agents work in real time — as animated pixel-art characters in a top-down office.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_GITHUB_USERNAME/agent-hq&env=GITHUB_CLIENT_ID,GITHUB_CLIENT_SECRET,AUTH_SECRET,TOKEN_ENCRYPTION_SECRET&envDescription=See%20.env.example%20for%20setup%20instructions&project-name=agent-hq)

## Setup (self-hosting)

1. **Fork this repo** and click the Deploy button above
2. **Create a GitHub OAuth App** at [github.com/settings/developers](https://github.com/settings/developers)
   - Homepage URL: `https://your-app.vercel.app`
   - Callback URL: `https://your-app.vercel.app/api/auth/callback/github`
3. **Fill in env vars** when Vercel prompts:
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — from your OAuth App
   - `AUTH_SECRET` — run `openssl rand -base64 32`
   - `TOKEN_ENCRYPTION_SECRET` — run `openssl rand -base64 32`
4. **Add Neon Postgres** via [Vercel Marketplace](https://vercel.com/marketplace) — `DATABASE_URL` auto-provisioned
5. **Run database migrations** once:
   ```bash
   # Pull env vars locally first:
   vercel env pull .env.local
   pnpm db:push
   ```
6. **Deploy** — `vercel --prod`

## Customizing agent roles

Edit `config/agent-roles.ts` to add/rename roles or adjust auto-detection patterns.
Edit `config/office-layout.ts` to change grid size, theme, or poll interval.

## Local development

```bash
pnpm install
vercel link          # connect to Vercel project
vercel env pull      # pull env vars
pnpm db:push         # apply schema
pnpm dev             # start dev server at http://localhost:3000
```
