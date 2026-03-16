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