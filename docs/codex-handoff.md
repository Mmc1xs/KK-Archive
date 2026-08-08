# Codex Handoff

Generated: `2026-08-08T09:37:42.207Z`

## Read First

1. `AGENTS.md`
2. `docs/codex-quick-start.md`
3. Relevant feature files before editing

## Repo Snapshot

- App: Next.js 16 and React 19 with Prisma-backed structured tag search
- Tool frontend: Vue 3 and Vite Plugin Data Reader
- Data: Supabase Postgres
- Storage: Cloudflare R2 for images and hosted files
- Deployment: Vercel with five-minute homepage ISR
- Search rule: existing DB tags only, no free-text search
- Roles: `ADMIN`, `AUDIT`, and `MEMBER`

## Important Commands

- `dev`: `next dev --webpack`
- `build`: `npm run tool:vue:build && prisma generate && next build`
- `build:postgres`: `npm run db:use:postgres && npm run tool:vue:build && prisma generate && next build`
- `guard:image-cost`: `node scripts/check-image-cost-guardrails.mjs`
- `tool:vue:check`: `vue-tsc --noEmit -p tools/plugin-data-reader-vue/tsconfig.json`
- `tool:vue:build`: `npm run tool:vue:check && vite build --config tools/plugin-data-reader-vue/vite.config.ts`
- `sync:new`: `npm run clean:sync-new`
- `sync:all`: `npm run clean:sync-all`
- `cut:import:queue`: `tsx scripts/import-cut-queue.ts`
- `mods:sync:telegram`: `tsx scripts/sync-mods-to-telegram-and-db.ts`

## High-Value Files

- `AGENTS.md`
- `docs/codex-quick-start.md`
- `lib/content.ts`
- `lib/db.ts`
- `components/home-page-view.tsx`
- `components/tag-autocomplete.tsx`
- `tools/plugin-data-reader-vue/src/App.vue`
- `docs/cut-telegram-semi-auto-workflow.md`
- `docs/mod-library-telegram-sync.md`

## Notes For New Sessions

- Run website development, build, Git, commit, and push commands only from `C:\Users\mlcmlc\Desktop\KK Diction Website`.
- Local `cut` and `up_mod` data stays outside Git under `C:\Users\mlcmlc\Desktop\KK Diction`; use its `cut.ps1` and `up_mod.ps1` launchers instead of scanning or moving that workspace.
- Never include `db image/` or `db mods/` in website commits. See `docs/workflow-storage.md` for path resolution.
- Locale homepages share five-minute caches for Latest Published and bulletins.
- Bulletin writes invalidate the bulletin cache; content writes invalidate Latest Published.
- Admin tag autocomplete has a two-minute browser cache and in-flight request deduplication.
- Homepage bulletins are database-managed at `/admin/homepage/bulletins` and do not require deployment.
- Mod Library records use Telegram message links and are restricted to signed-in members.
- Run `git status --short` at the start of every task; this handoff intentionally does not snapshot transient worktree state.
- Follow `AGENTS.md` pre-push UI and build verification rules.
