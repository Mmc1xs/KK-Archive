# Codex Quick Start

This file is for fresh Codex sessions that need to understand the project quickly with minimal back-and-forth.

## Read Order

1. `AGENTS.md`
2. `docs/codex-quick-start.md`
3. `docs/codex-handoff.md` if it exists
4. Relevant feature files before editing

## Project Snapshot

- Project: `KK Archive`
- Goal: maintainable image browsing site with structured tag-based search
- Stack: `Next.js 16`, `React 19`, `TypeScript`, `Prisma`, `Postgres`, `Cloudflare R2`
- Public search must use existing database tags only
- No free-text search
- Each content must have exactly one author tag

## Main Folders

- `app`: Next.js routes, pages, server actions, API routes
- `components`: UI and admin/search components
- `lib`: database, content queries, storage helpers, validation
- `prisma`: schema and seed files
- `scripts`: import, sync, migration, reporting, and utility scripts
- `docs`: operational and deployment notes

Local data is intentionally outside this Git repository:

- Website/Git root: `C:\Users\mlcmlc\Desktop\KK Diction Website`
- `cut` / `up_mod` data root: `C:\Users\mlcmlc\Desktop\KK Diction`
- Run `cut.ps1` and `up_mod.ps1` from the data root; never commit from that directory.

## Important Workflows

### Legacy site content import pipeline

- Telegram/media data lives under the external workflow root, for example `db image/clean/<id>`
- Full pipeline:
  - `npm run clean:manifest`
  - `npm run clean:pixiv`
  - `npm run r2:upload-clean`
  - `npm run clean:post-json`
  - `npm run clean:import-all`
- Incremental pipeline:
  - `npm run sync:new`

### Telegram raw image grab

- Raw Telegram data is stored under the external workflow root.
- It is separate from the normal clean import pipeline

### Tag review workflow

- Review source data and generated tag files live under the external workflow root.
- Tag review scripts:
  - `npm run tag:export-review`
  - `npm run tag:import-review`
- Current helper scripts:
  - `scripts/build-work-tag-json.ts`
  - `scripts/import-tag-review-json.ts`

### Content image replacement

- For local folder-based image swaps on an existing content record:
  - `npm run content:replace-images -- <contentId> "<imageFolder>"`
- Reference doc:
  - `docs/content-image-replacement.md`

## Current Tag Notes

- Content detail `Work` pills are intended to route into `/search?work=<slug>`
- Search already supports work filters from DB tags
- Review JSON import is used to backfill `WORK`, `CHARACTER`, and `STYLE` tags onto existing content

## Useful Commands

- Dev server: `npm run dev`
- Build: `npm run build`
- Image cost guardrail: `npm run guard:image-cost`
- Incremental sync: `npm run sync:new`
- Full sync: `npm run sync:all`
- R2 only: `npm run r2:upload-clean:new`
- Export review JSON: `npm run tag:export-review`
- Import review JSON: `npm run tag:import-review`
- Generate Codex handoff: `npm run codex:handoff`

## Git Boundary

- Run status, build, commit, and push only from `KK Diction Website`.
- `db image` and `db mods` are ignored here and must remain in the sibling local workflow workspace.
- See `docs/workflow-storage.md` for the path-resolution rules.

## Session Reset Prompt

When starting a new Codex session, give it this instruction first:

```text
Please read AGENTS.md, docs/codex-quick-start.md, and docs/codex-handoff.md first. Then inspect only the files relevant to the task before editing anything.
```
