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

## Performance & Security guardrails
- Keep public pages cache-friendly; do not make the entire app dynamic just to read session state.
- Scope session reads to protected routes/components whenever possible.
- Add and maintain database indexes for frequent filters/sorts (especially foreign key + sort order patterns).
- Keep search/filter APIs lightweight and cache-aware; avoid unnecessary repeated requests.
- Prefer deployment/runtime regions close to the primary database region.
- Never expose raw private storage credentials; member downloads should use controlled server-issued links/tokens.
- Set explicit cache policies for static storage assets (such as images) when object names are immutable.
- Track route-level latency (TTFB/total time) and optimize bottlenecks before adding new heavy features.

## Before coding
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
