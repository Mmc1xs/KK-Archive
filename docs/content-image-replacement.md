# Content Image Replacement

Use this when a content item already exists and its cover/gallery images need to be swapped with a new local folder of files.

## Minimal flow

1. Put the replacement images in a local folder.
2. Run:

```bash
npm run content:replace-images -- <contentId> "<imageFolder>"
```

Example:

```bash
npm run content:replace-images -- 3823 "db image/1"
```

3. The script will:
   - upload the folder images to `contents/<storageFolder>/` in R2
   - replace `coverImageUrl`
   - replace `content_images`
   - delete the old R2 objects that are no longer referenced

## Intentional simplifications

- Only keep the checks that matter:
  - content exists
  - image folder exists
  - at least one image is present
  - sanitized filenames do not collide
- Skip extra build/typecheck/page smoke checks unless you are debugging a separate issue.
- If the public page does not reflect the change immediately, refresh the page or restart the local Next server.
