# Cut Queue Import

`db image/cut/queue.json` is the AI-assisted input file for cut imports.

## Minimal fields per item

- `folder`: cut folder name under `db image/cut`
- `sourceLink`: Pixiv artwork URL when verified, or `null`/empty only with owner-approved no-source handling
- `tgLink`: Telegram post/archive URL (optional, but keep it when available)
- Style: provide at least one non-empty `styleNames` value, or use `copyTagsFromSlug` only when the referenced card already has a Style tag

Every imported card must have exactly one Type and at least one Style. Type defaults to `KK` only when neither the item, queue defaults, nor `copyTagsFromSlug` supplies one. If Style is uncertain, stop and ask the owner; do not guess or import the card without Style.

When `sourceLink` is a Pixiv artwork URL, the importer auto-fetches `title` + `author` from Pixiv.
When `sourceLink` is empty, set `skipPixivMetadataFetch: true` and provide explicit `titleOverride`, `authorOverride`, and `workName`.

## Optional AI hints

- `imageFileNames`: upload only the listed root-level preview images; use this when one reviewed folder contains multiple content items
- `downloadFileNames`: upload only the listed files from `d/`
- `workName`: force work tag (if auto work inference is wrong)
- `characterName`: override character tag name (default = folder name)
- `copyTagsFromSlug`: copy work/style/usage/type from an existing content slug
- `titleOverride` / `authorOverride`: manually override Pixiv values
- `typeName`: override the Type tag; omit it to use the queue/reference value or the `KK` fallback
- `styleNames` / `usageNames`: force style/usage tags (`styleNames` is required unless a referenced card supplies Style)
- `description`: custom description

## Run

- default queue file:
  - `npm run cut:import:queue`
- specific queue file:
  - `npm run cut:import:queue:file -- "db image/cut/queue.example.json"`

## Behavior

- Skips item when a non-empty `sourceLink` already exists in DB, unless `allowDuplicateSource` is set.
- Uploads all root-level images in the folder to `contents/<content-slug>/...`.
- Uploads selected `downloadFileNames`, or all files in `d/`, to `uploadfiles/<content-slug>/...` and auto-creates website download links.
- Rejects local download files over 200 MiB; use owner-approved external/archive links for large files.
- Adds TG link as the last download link when `tgLink` is provided.
- Creates/imports tags from explicit overrides, so source-less imports must be reviewed carefully before upload.
