# AGENTS.md

## Project goal
Build a maintainable image browsing website with structured tag-based search.

## Rules
- Do not add features outside the written spec.
- Do not implement public upload.
- Do not implement free-text search.
- Search must only use existing database tags.
- Each content item must have exactly one author tag.
- Keep author/style/usage tags separated in UI and logic.

## Technical preferences
- Prefer simple, maintainable architecture.
- Prefer clear file names and small components.
- Use server-side validation for admin actions.
- Keep admin routes protected by role checks.
- Avoid unnecessary abstractions.
- Keep all user-facing locale strings in valid UTF-8 source text and preserve each language's exact wording when editing multilingual UI.
- Never leave mojibake, partial corruption, or mixed-language fallback text in locale labels, nav menus, or translated buttons.
- After changing multilingual UI text, verify the edited strings compile cleanly and render correctly in the target locale before moving on.

## Performance & Security guardrails
- Keep public pages cache-friendly; do not make the entire app dynamic just to read session state.
- Scope session reads to protected routes/components whenever possible.
- Add and maintain database indexes for frequent filters/sorts (especially foreign key + sort order patterns).
- Keep search/filter APIs lightweight and cache-aware; avoid unnecessary repeated requests.
- Prefer deployment/runtime regions close to the primary database region.
- Keep Next.js image optimizer globally disabled (`next.config.ts` -> `images.unoptimized: true`) unless the owner explicitly approves re-enabling it after a cost review.
- Never expose raw private storage credentials; member downloads should use controlled server-issued links/tokens.
- Set explicit cache policies for static storage assets (such as images) when object names are immutable.
- Track route-level latency (TTFB/total time) and optimize bottlenecks before adding new heavy features.

## Local environment safety
- Do not run `prisma generate --no-engine` in the main workspace.
- Do not repoint, symlink, or junction the main workspace `node_modules` or Prisma client to another worktree.
- If a temporary worktree or verification flow needs isolated dependencies, keep it fully isolated from the main workspace.
- If Prisma client initialization breaks locally, restore it in the main workspace with `npm install` and `npx prisma generate` before doing anything else.

## Pre-commit / Pre-push verification
- Run `npm run guard:image-cost` before every push; do not push when this check fails.
- Never commit or push only on the basis of `tsc`, build success, or local reasoning when the change affects a user flow.
- Before commit/push, re-test every changed flow end-to-end in the real UI or route it affects, and confirm there is no visible bug, stuck state, hydration warning, invalid validation message, or silent partial failure.
- If a change touches content editing, always verify all of these on a real content record:
  - open `/admin/contents/[id]/edit`
  - edit and save ordinary fields successfully
  - if Hosted Files / R2 upload is involved, upload a file successfully
  - confirm `Website (R2)` is generated or updated correctly
  - confirm `Update Content` / `Update and Pass` does not hang or fail
  - confirm the saved result is visible after reload
- If a change touches hosted file upload or download links, always verify:
  - R2 object key/path is the expected format
  - Hosted Files UI reflects the upload result correctly
  - auto-linked website download links are valid and pass validation
  - the edit page can still save after upload
- If a change touches search, always verify:
  - the search page loads
  - every modified filter appears in the UI
  - filter selection actually affects results
  - no related API route returns 500
- If a change touches auth/session/role checks, always verify:
  - intended roles can see and use the entry point/button
  - unintended roles cannot access the page or action
  - login/session state does not break public pages
- If a change touches analytics/view tracking/background writes, always verify:
  - content detail page still loads normally
  - edit/save flows are not blocked by analytics writes
  - admin analytics pages still render expected numbers
- Before commit/push, check logs for the exercised flow and make sure there are no unresolved server errors, Prisma errors, statement timeouts, nested form warnings, or hydration mismatches related to the change.
- If a bug is discovered during verification, fix the root cause first and re-run the affected flow before commit/push.

## Before coding
- In fresh sessions, read `docs/codex-quick-start.md` and `docs/codex-handoff.md` if present before making assumptions.
- Propose folder structure.
- Propose database schema.
- Propose route list.
- Then implement step by step.

## Definition of done
- Public pages work
- Admin pages work
- Tag filtering works
- Only published content is public
- Author constraint is enforced
