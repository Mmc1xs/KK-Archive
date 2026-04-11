# Codex Handoff

Generated: `2026-03-26T14:44:31.092Z`

## Read First

1. `AGENTS.md`
2. `docs/codex-quick-start.md`
3. Relevant feature files before editing

## Repo Snapshot

- Branch: `master`
- App: Next.js app with Prisma-backed structured tag search
- Storage: Cloudflare R2 for public images
- Search rule: existing DB tags only, no free-text search
- Important data workspace: `db image`

## Important Commands

- `dev`: `next dev`
- `build`: `prisma generate && next build`
- `sync:new`: `npm run clean:sync-new`
- `sync:all`: `npm run clean:sync-all`
- `r2:upload-clean:new`: `tsx scripts/upload-new-clean-to-r2.ts`
- `r2:upload-clean`: `tsx scripts/upload-clean-to-r2.ts`
- `tag:export-review`: `tsx scripts/export-tag-review-json.ts`
- `tag:import-review`: `tsx scripts/import-tag-review-json.ts`

## Current Worktree

- `M AGENTS.md`
- ` M components/tag-links.tsx`
- ` M next-env.d.ts`
- ` M package.json`
- `?? .devserver.log`
- `?? .edit-page.html`
- `?? "db image/tag.json"`
- `?? "db image/tag/"`
- `?? docs/codex-quick-start.md`
- `?? scripts/build-work-tag-json.ts`
- `?? scripts/export-tag-review-json.ts`
- `?? scripts/generate-codex-handoff.ts`
- `?? scripts/import-tag-review-json.ts`

## High-Value Files

- `AGENTS.md`
- `docs/codex-quick-start.md`
- `lib/content.ts`
- `lib/db.ts`
- `components/tag-links.tsx`
- `scripts/import-tag-review-json.ts`
- `scripts/build-work-tag-json.ts`
- `db image/grab_telegram_images.py`

## Notes For New Sessions

- `db image/tag/*.json` is review data used to backfill work/character/style tags.
- `db image/tag.json` is a generated alias map for work tags.
- Telegram raw media grabbing and clean import are related but separate workflows.
- If the task is about content visibility, check `publishStatus` handling in Prisma and content queries.
