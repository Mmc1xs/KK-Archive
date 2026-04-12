import "./load-env";
import { createReadStream } from "fs";
import { readdir, stat } from "fs/promises";
import path from "path";
import { db } from "../lib/db";
import { buildR2PublicUrl, deleteR2Object, extractR2ObjectKeyFromPublicUrl, uploadR2Object } from "../lib/storage/r2";
import { ensureContentStorageFolder, sanitizeUploadFileName } from "../lib/uploads";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".bmp", ".tif", ".tiff"]);

function getContentType(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".avif":
      return "image/avif";
    case ".bmp":
      return "image/bmp";
    case ".tif":
    case ".tiff":
      return "image/tiff";
    default:
      return "application/octet-stream";
  }
}

async function readImageFiles(folderPath: string) {
  const entries = await readdir(folderPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort((left, right) => left.localeCompare(right, "en-US"));
}

async function main() {
  const [contentIdArg, sourceFolderArg] = process.argv.slice(2);
  if (!contentIdArg || !sourceFolderArg) {
    throw new Error("Usage: npm run content:replace-images -- <contentId> <imageFolder>");
  }

  const contentId = Number(contentIdArg);
  if (!Number.isInteger(contentId) || contentId <= 0) {
    throw new Error("Content id must be a positive integer");
  }

  const sourceFolder = path.resolve(process.cwd(), sourceFolderArg);
  const content = await db.content.findUnique({
    where: { id: contentId },
    select: {
      id: true,
      storageFolder: true,
      coverImageUrl: true,
      images: {
        select: { imageUrl: true },
        orderBy: { sortOrder: "asc" }
      }
    }
  });

  if (!content) {
    throw new Error(`Content not found: ${contentId}`);
  }

  const files = await readImageFiles(sourceFolder);
  if (!files.length) {
    throw new Error(`No image files found in: ${sourceFolder}`);
  }

  const storageFolder = await ensureContentStorageFolder(contentId);
  if (!storageFolder) {
    throw new Error(`Unable to resolve storage folder for content ${contentId}`);
  }

  const uploaded: Array<{ key: string; url: string }> = [];
  const oldKeys = new Set<string>();
  const addOldKey = (url?: string | null) => {
    const key = extractR2ObjectKeyFromPublicUrl(url);
    if (key) {
      oldKeys.add(key);
    }
  };

  addOldKey(content.coverImageUrl);
  for (const image of content.images) {
    addOldKey(image.imageUrl);
  }

  const seenFileNames = new Set<string>();
  for (const fileName of files) {
    const safeFileName = sanitizeUploadFileName(fileName);
    if (seenFileNames.has(safeFileName)) {
      throw new Error(`Duplicate file name after sanitizing: ${safeFileName}`);
    }
    seenFileNames.add(safeFileName);

    const filePath = path.join(sourceFolder, fileName);
    const fileStats = await stat(filePath);
    const key = `contents/${storageFolder}/${safeFileName}`;

    await uploadR2Object({
      key,
      body: createReadStream(filePath),
      contentType: getContentType(fileName),
      contentLength: fileStats.size
    });

    uploaded.push({
      key,
      url: buildR2PublicUrl(key)
    });
  }

  await db.$transaction(async (tx) => {
    await tx.content.update({
      where: { id: contentId },
      data: {
        coverImageUrl: uploaded[0].url
      }
    });

    await tx.contentImage.deleteMany({
      where: { contentId }
    });

    await tx.contentImage.createMany({
      data: uploaded.map((item, index) => ({
        contentId,
        imageUrl: item.url,
        sortOrder: index
      }))
    });
  });

  for (const key of oldKeys) {
    if (!uploaded.some((item) => item.key === key)) {
      await deleteR2Object(key);
    }
  }

  console.log(
    JSON.stringify(
      {
        contentId,
        storageFolder,
        sourceFolder,
        uploadedCount: uploaded.length,
        coverImageUrl: uploaded[0].url
      },
      null,
      2
    )
  );
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect().catch(() => null);
  process.exit(1);
});
