import "./load-env";
import { createReadStream, existsSync } from "fs";
import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { Upload } from "@aws-sdk/lib-storage";
import { buildR2PublicUrl, createR2Client, getR2Config } from "../lib/storage/r2";

type CleanMeta = {
  anchor_message_id: number;
  downloaded: Array<{
    message_id: number;
    path: string;
  }>;
  text?: string;
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

async function readCleanFolders() {
  const entries = await readdir(cleanRoot, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
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
  const manifest: UploadManifestEntry[] = [];

  for (const folder of folders) {
    const { meta, metaPath } = await readMeta(folder);
    const uploaded: UploadManifestEntry["uploaded"] = [];

    for (const item of meta.downloaded) {
      const fileName = path.basename(item.path);
      const sourcePath = path.join(cleanRoot, folder, fileName);
      if (!existsSync(sourcePath)) {
        console.warn(`Skip missing file: ${sourcePath}`);
        continue;
      }

      const objectKey = toObjectKey(folder, fileName);

      await uploadFile(client, bucketName, sourcePath, objectKey);

      uploaded.push({
        sourcePath,
        objectKey,
        publicUrl: buildR2PublicUrl(objectKey)
      });
    }

    manifest.push({
      contentFolder: folder,
      anchorMessageId: meta.anchor_message_id,
      sourceMetaPath: metaPath,
      uploaded
    });
    console.log(`[R2] ${folder}: uploaded ${uploaded.length} files`);
  }

  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`Manifest written to ${manifestPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
