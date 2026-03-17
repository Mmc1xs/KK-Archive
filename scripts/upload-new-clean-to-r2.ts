import "./load-env";
import { createReadStream, existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { Upload } from "@aws-sdk/lib-storage";
import { buildR2PublicUrl, createR2Client, getR2Config } from "../lib/storage/r2";
import { db } from "../lib/db";

type CleanMeta = {
  anchor_message_id: number;
  downloaded: Array<{
    message_id: number;
    path: string;
  }>;
};

type UploadManifestEntry = {
  contentFolder: string;
  anchorMessageId: number;
  sourceMetaPath: string;
  uploaded: Array<{
    sourcePath: string;
    objectKey: string;
    publicUrl: string;
  }>;
};

const cleanRoot = path.resolve(process.cwd(), process.env.CLEAN_IMAGE_ROOT || "db image/clean");
const manifestPath = path.resolve(process.cwd(), "scripts", "r2-upload-manifest.json");

async function persistManifest(manifestMap: Map<string, UploadManifestEntry>) {
  const out = Array.from(manifestMap.values()).sort((a, b) => Number(a.contentFolder) - Number(b.contentFolder));
  await writeFile(manifestPath, JSON.stringify(out, null, 2), "utf8");
}

async function readCleanFolders() {
  const { readdir } = await import("fs/promises");
  const entries = await readdir(cleanRoot, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort((a, b) => Number(a) - Number(b));
}

async function readMeta(folder: string) {
  const metaPath = path.join(cleanRoot, folder, "_meta.json");
  const raw = await readFile(metaPath, "utf8");
  return {
    metaPath,
    meta: JSON.parse(raw) as CleanMeta
  };
}

function toObjectKey(folder: string, fileName: string) {
  return `contents/${folder}/${fileName}`;
}

async function uploadFile(client: ReturnType<typeof createR2Client>, bucketName: string, sourcePath: string, objectKey: string) {
  const uploader = new Upload({
    client,
    params: {
      Bucket: bucketName,
      Key: objectKey,
      Body: createReadStream(sourcePath),
      ContentType: sourcePath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg"
    }
  });

  await uploader.done();
}

async function main() {
  if (!existsSync(cleanRoot)) {
    throw new Error(`Clean image root not found: ${cleanRoot}`);
  }

  const client = createR2Client();
  const { bucketName } = getR2Config();
  const folders = await readCleanFolders();
  const existing = existsSync(manifestPath)
    ? (JSON.parse(await readFile(manifestPath, "utf8")) as UploadManifestEntry[])
    : [];
  const manifestMap = new Map(existing.map((entry) => [entry.contentFolder, entry]));
  const existingLinks = await db.contentDownloadLink.findMany({
    select: { url: true }
  });
  const existingLinkSet = new Set(existingLinks.map((item) => item.url));

  let touchedFolders = 0;
  let uploadedFiles = 0;

  for (const folder of folders) {
    if (existingLinkSet.has(`https://t.me/Koikatunews/${folder}`)) {
      continue;
    }

    const { meta, metaPath } = await readMeta(folder);
    const existingEntry = manifestMap.get(folder);
    const uploadedBySource = new Map((existingEntry?.uploaded ?? []).map((item) => [item.sourcePath, item]));
    const nextUploaded = [...(existingEntry?.uploaded ?? [])];
    let folderUploadedCount = 0;

    for (const item of meta.downloaded) {
      const fileName = path.basename(item.path);
      const sourcePath = path.join(cleanRoot, folder, fileName);
      if (!existsSync(sourcePath)) {
        console.warn(`Skip missing file: ${sourcePath}`);
        continue;
      }

      if (uploadedBySource.has(sourcePath)) {
        continue;
      }

      const objectKey = toObjectKey(folder, fileName);
      await uploadFile(client, bucketName, sourcePath, objectKey);

      nextUploaded.push({
        sourcePath,
        objectKey,
        publicUrl: buildR2PublicUrl(objectKey)
      });
      folderUploadedCount += 1;
      uploadedFiles += 1;
    }

    if (!existingEntry || folderUploadedCount > 0) {
      manifestMap.set(folder, {
        contentFolder: folder,
        anchorMessageId: meta.anchor_message_id,
        sourceMetaPath: metaPath,
        uploaded: nextUploaded.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath))
      });
      touchedFolders += 1;
      await persistManifest(manifestMap);
    }

    if (folderUploadedCount > 0) {
      console.log(`[R2:NEW] ${folder}: uploaded ${folderUploadedCount} file(s)`);
    }
  }

  await persistManifest(manifestMap);
  console.log(`Updated ${touchedFolders} folder(s), uploaded ${uploadedFiles} new file(s) -> ${manifestPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
