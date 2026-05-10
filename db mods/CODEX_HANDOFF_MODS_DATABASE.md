# KK Mods Database Handoff (for next Codex)

## 1) Goal and Scope
This folder contains extracted mod metadata JSON to be used as the source dataset for a website database.

Primary objective for the next Codex:
- Ingest `mods_table.json` into a database-backed web app.
- Do **not** use any duplicate-analysis JSON files in this handoff.

## 2) Authoritative Source File
- `mods_table.json` (only)

Current snapshot stats (generated on 2026-05-08):
- Total mods: `4770`

## 3) `mods_table.json` schema
Top-level: JSON array

Each item:
```json
{
  "Name": "string",
  "Version": "string (can be empty)",
  "Author": "string (can be empty)",
  "Guid": "string",
  "Filename": "string",
  "Location": "absolute Windows path"
}
```

Notes:
- `Version` and `Author` intentionally allow `""`.
- `Location` is absolute and includes original folder structure under `mods`.
- Encoding is UTF-8 and includes multilingual text (JP/CN etc). Ensure DB collation/charset supports Unicode.

## 4) Important behavior context (from KKManager logic)
These fields were extracted through KKManager zipmod parsing logic, not by filename regex only.
- Mods are read from zip-like extensions: `.zip`, `.zipmod`, `.zi_`, `.zi_mod`.
- Metadata (`Name`, `Version`, `Author`, `Guid`, etc.) comes from each archive manifest.
- `Guid` is the most useful identity field for lineage/conflict views in the future.

## 5) Recommended DB model (pragmatic)
Use one table first:

`mods`
- `id` (pk)
- `name`
- `version`
- `author`
- `guid`
- `filename`
- `location`
- `created_at`, `updated_at`

Suggested indexes:
- index on `guid`
- index on `filename`
- composite index on (`name`, `version`, `author`)

## 6) Data hygiene rules
- Preserve original raw strings for display.
- For search, add normalized shadow fields (lowercased/trimmed) in app layer or DB computed columns.
- Never mutate original files during import.
- Treat empty `Version`/`Author` as known missing metadata, not parse failures.

## 7) Suggested website features (phase order)
Phase 1:
- list mods
- keyword search (`name`, `author`, `guid`, `filename`)
- sort by `name`, `version`, `author`

Phase 2:
- detail page per mod
- filters by `author` and `guid`

Phase 3:
- export selected rows (JSON/CSV)
- optional grouping views (if user later asks)

## 8) Quick validation checklist after import
- Row count in DB equals `4770`.
- Unicode names render correctly on UI.
- Paths in `location` remain intact and searchable.

## 9) Handoff assumptions
- This dataset is a snapshot-in-time and may change if user rescans mods later.
- This handoff intentionally excludes any duplicate-analysis JSON because that dataset is currently considered unreliable.
