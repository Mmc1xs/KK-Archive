# Cut Queue Import

`db image/cut/queue.json` is the AI-assisted input file for cut imports.

## Minimal fields per item

- `folder`: cut folder name under `db image/cut`
- `sourceLink`: Pixiv artwork URL
- `tgLink`: Telegram post URL (optional)

The importer auto-fetches `title` + `author` from Pixiv.

## Optional AI hints

- `workName`: force work tag (if auto work inference is wrong)
- `characterName`: override character tag name (default = folder name)
- `copyTagsFromSlug`: copy work/style/usage/type from an existing content slug
- `titleOverride` / `authorOverride`: manually override Pixiv values
- `styleNames` / `usageNames`: force style/usage tags
- `description`: custom description

## Run

- default queue file:
  - `npm run cut:import:queue`
- specific queue file:
  - `npm run cut:import:queue:file -- "db image/cut/queue.example.json"`

## Behavior

- Skips item when `sourceLink` already exists in DB.
- Uploads all images in the folder to `contents/<content-slug>/...`.
- Uploads all files in `d/` to `uploadfiles/<content-slug>/...` and auto-creates website download links.
- Adds TG link as the last download link when `tgLink` is provided.
