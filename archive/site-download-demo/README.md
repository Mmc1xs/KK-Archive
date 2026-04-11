# Site Download Demo Archive

This folder stores the disabled `site-download-demo` feature so it can be restored later without rebuilding it from scratch.

The active app no longer exposes:

- `/admin/site-download-demo`
- `/admin/site-download-demo/[contentId]`
- `/api/admin/site-download-demo/[contentId]/upload`
- admin dashboard entry points
- site-demo-only server actions and CSS hooks

Archived source files are preserved here with their original relative structure:

- `app/admin/site-download-demo/...`
- `app/api/admin/site-download-demo/...`
- `components/admin/...`
- `lib/demo/...`
- `scripts/telegram_demo_bridge.py`

Notes:

- Prisma schema and existing `ContentSiteDownloadDemo` data were intentionally left in place.
- `archive/` is outside the TypeScript `include` list, so archived code does not affect the current build.
- To restore the feature later, move the archived files back to their original locations and reconnect the imports, admin links, and styles.
