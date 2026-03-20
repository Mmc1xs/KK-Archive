# Deployment Stack

Recommended production split for this project:

- Vercel: Next.js app
- Hosted Postgres: Supabase / Neon / other managed provider
- Cloudflare R2: image storage
- Cloudflare DNS/SSL: domain + TLS + caching

## Why

- The app already stores images as URLs, so R2 fits the current schema.
- The current clean image library is already larger than Supabase Free Storage.
- Moving image delivery away from the app server reduces future bandwidth pressure.

## Phase 1

- Keep the current app working locally.
- Add R2 environment variables.
- Add an upload script for `db image/clean`.
- Generate a manifest of uploaded files and public URLs.
- Generate a clean import manifest from `db image/clean/*/_meta.json`.

## Phase 2

- Move Prisma from SQLite to hosted Postgres.
- Keep the current custom Google OAuth + cookie session unless you intentionally want to replace it later.
- Run a one-time SQLite -> Postgres data migration before deployment.

## Postgres Migration Workflow

1. Keep local development on SQLite:

```bash
DATABASE_URL="file:./prisma/dev.db"
```

2. Fill the target Postgres URL:

```bash
POSTGRES_POOLED_URL="postgresql://...pooler...:6543/postgres?pgbouncer=true&connection_limit=1"
POSTGRES_SESSION_URL="postgresql://...pooler...:5432/postgres"
POSTGRES_DIRECT_URL="postgresql://...db...:5432/postgres" # optional, IPv6 / IPv4 add-on only
```

3. Generate the Postgres Prisma client:

```bash
npm run db:generate:postgres
```

4. Push the Postgres schema:

```bash
npm run db:push:postgres
```

5. Copy local data into Postgres:

```bash
npm run db:migrate:sqlite-to-postgres
```

6. Switch the runtime Prisma schema used by the app:

```bash
npm run db:use:postgres
```

7. Build the production app:

```bash
npm run build:postgres
```

If you want to continue local SQLite development later, switch back with:

```bash
npm run db:use:sqlite
npm run db:generate
```

This migration copies:

- users
- user login events
- contents
- content images
- content download links
- tags
- content-tag relations

The migration script also resets Postgres sequences after the copy so future inserts continue from the correct IDs.

## R2 Upload Script

Command:

```bash
npm run r2:upload-clean
```

Expected environment variables:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_BASE_URL`
- `CLEAN_IMAGE_ROOT`

The script writes a manifest to `scripts/r2-upload-manifest.json`.

## Clean Import Manifest

Command:

```bash
npm run clean:manifest
```

The script reads each `db image/clean/<folder>/_meta.json` and extracts:

- folder id
- anchor message id
- Pixiv artwork URL
- Pixiv artwork ID
- local image paths
- first image as cover candidate
- raw source text

## Post JSON Generation

Command order for a full rebuild:

```bash
npm run clean:manifest
npm run clean:pixiv
npm run r2:upload-clean
npm run clean:post-json
npm run clean:import-all
```

`clean:post-json` now uses R2 public URLs from `scripts/r2-upload-manifest.json` as the final `coverImageUrl` and `imageUrls` written into each `db image/clean/<folder>/post.json`.

For normal day-to-day updates, prefer:

```bash
npm run sync:new
```

This now only processes folders that have not yet been imported into the site:

```bash
npm run clean:pixiv:new
npm run r2:upload-clean:new
npm run clean:post-json:new
npm run clean:import-new
```

For a full rebuild and re-import of the entire clean library, use:

```bash
npm run sync:all
```

Notes:

- `clean:manifest` does not need to run twice.
- `clean:post-json` only writes `post.json`; it does not import into the database.
- `clean:post-json:new` only rewrites `post.json` for folders that are not yet imported.
- `sync:new` is a short alias for `clean:sync-new`.
- `sync:all` is a short alias for `clean:sync-all`.
- Database import happens in `clean:import-new` or `clean:import-all`.

## Move Unuploaded Folders to `db image/later`

If you do not want to manually inspect every clean folder, you can auto-move
folders that are both:

- not uploaded to R2 (no uploaded entry in `scripts/r2-upload-manifest.json`)
- not imported into DB (no matching `https://t.me/Koikatunews/<folder>` download link)

Dry-run preview (no file changes):

```bash
npm run clean:move-unuploaded:later
```

Apply move:

```bash
npm run clean:move-unuploaded:later:apply
```

The script moves matching folders from:

- `db image/clean/<folder>`

to:

- `db image/later/<folder>`

If the target folder name already exists in `later`, it appends a numeric suffix automatically.
