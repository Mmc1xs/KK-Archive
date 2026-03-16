# KK Diction

A v1 web app for image browsing and structured tag-based search.

## Stack

- Next.js App Router
- TypeScript
- Prisma
- SQLite
- Google OAuth sign-in
- Custom cookie-based session auth

## Included

- Public pages: `/`, `/contents`, `/contents/[slug]`, `/search`
- Member pages: `/login`, `/register`
- Admin pages: `/admin`, `/admin/contents`, `/admin/contents/new`, `/admin/contents/[id]/edit`, `/admin/tags`
- Public pages only show `PUBLISHED` content
- Logged-in members can also view `SUMMIT` content
- Search uses only database-backed `author`, `style`, `usage`, and `type` tags
- Content can also be assigned fixed `type` tags: `Character card`, `Scene Card`, `Overlay`, `Texture`
- Server-side validation enforces at least one author tag per content item
- Status rules:
  - `PUBLISHED`: visible without login
  - `SUMMIT`: visible to logged-in users
  - `DRAFT`: visible in admin only

## Setup

1. Run `npm install`
2. Copy `.env.example` to `.env`
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`
4. Run `npm run db:generate`
5. Run `npm run db:push`
6. Run `npm run db:seed`
7. Run `npm run dev`

## Production Migration (Option B)

Recommended production split:

- Vercel: Next.js app
- Managed Postgres: Supabase / Neon / other hosted Postgres
- Cloudflare R2: image storage

The current local app can continue using SQLite. When you are ready to move to production Postgres:

1. Fill these in `.env`:
   - `POSTGRES_POOLED_URL` (Supavisor transaction mode, add `?pgbouncer=true&connection_limit=1`)
   - `POSTGRES_SESSION_URL`
   - `POSTGRES_DIRECT_URL` only if your local network supports IPv6
2. Generate the Postgres Prisma client:
   - `npm run db:generate:postgres`
3. Push the Postgres schema:
   - `npm run db:push:postgres`
4. Copy local SQLite data into Postgres:
   - `npm run db:migrate:sqlite-to-postgres`
5. Switch the runtime Prisma schema to Postgres before a production build:
   - `npm run db:use:postgres`
6. Build for Vercel / production:
   - `npm run build:postgres`

When you want to continue local SQLite development afterward:

- `npm run db:use:sqlite`
- `npm run db:generate`

After the data is verified in Postgres, you can switch the main app runtime to a Postgres-backed Prisma schema for deployment.

## Google Sign-In

- New accounts are created through Google sign-in only
- Only Google-verified email accounts can sign in
- Existing users with the same email are linked automatically on first Google login
- Google OAuth callback for local development:
  - `http://localhost:3000/auth/google/callback`

## Incremental Import Workflow

When you add new folders into `db image/clean`, the lightest workflow is:

1. Run `npm run clean:sync-new`

This will:

- refresh the base clean manifest
- enrich only new or incomplete Pixiv metadata
- upload only new images to Cloudflare R2
- rebuild all `post.json` files
- import only content that is not already in the database

You can also run each step separately:

- `npm run clean:pixiv:new`
- `npm run r2:upload-clean:new`
- `npm run clean:post-json`
- `npm run clean:import-new`

## Production Direction

- App hosting: Vercel
- Database: Hosted Postgres
- Image storage: Cloudflare R2

See [deployment-stack.md](/c:/Users/mlcmlc/Desktop/KK%20Diction/docs/deployment-stack.md) for the phase plan and migration workflow.
