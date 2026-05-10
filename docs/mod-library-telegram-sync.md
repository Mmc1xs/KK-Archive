# Mod Library Telegram Sync

This flow uploads mod files listed in `db mods/mods_table.json` to Telegram, stores `MessageLink`, and upserts records into `mod_library_entries` (Supabase/Postgres via Prisma).

## Command

```bash
npm run mods:sync:telegram -- --channel https://t.me/KK_archive_modlibrary
```

## Useful flags

- `--dry-run`  
  Preview candidate selection only.
- `--limit 10`  
  Process first 10 candidates.
- `--skip-failed`  
  Skip rows that previously failed (recorded in state file).
- `--include-linked`  
  Include rows that already have `MessageLink` (for DB backfill/upsert).
- `--no-db`  
  Upload and write `mods_table.json` only, skip DB upsert.
- `--session-file "db image/koikatu_session.session"`  
  Force a specific Telegram session file.

## Required env

- `TG_API_ID`
- `TG_API_HASH`
- Session:
  - Preferred: `db image/koikatu_session.session`
  - Fallback: `TG_SESSION` (Telethon string session or session name)

## Output files

- State: `db mods/tg_upload_state.json`
  - Keeps per-entry attempts, status, last error, and message link.
- Compensation queue: `db mods/tg_upload_compensation.json`
  - Keeps tasks that need replay (e.g. DB upsert failure or table-write failure after upload success).

## Identity rule

Entry identity key is:

`Guid + Version + Filename`

This allows **same Guid with different Version** to coexist and upload independently.

## Notes

- Upload caption is intentionally empty.
- Frontend uses `messageLink`; raw local `Location` is not exposed publicly.
- Upsert target is admin-managed `mod_library_entries`, and admin pages remain protected by role checks.

