import "./load-env";
import { existsSync } from "fs";
import { mkdir, readdir, readFile, rename } from "fs/promises";
import path from "path";
import { db } from "../lib/db";

type UploadManifestEntry = {
  contentFolder: string;
  uploaded?: Array<{
    sourcePath: string;
    objectKey: string;
    publicUrl: string;
  }>;
};

const cleanRoot = path.resolve(process.cwd(), process.env.CLEAN_IMAGE_ROOT || "db image/clean");
const laterRoot = path.resolve(process.cwd(), "db image/later");
const manifestPath = path.resolve(process.cwd(), "scripts", "r2-upload-manifest.json");

function hasApplyFlag() {
  return process.argv.includes("--apply");
}

async function readUploadedFolderSet() {
  if (!existsSync(manifestPath)) {
    return new Set<string>();
  }

  const raw = await readFile(manifestPath, "utf8");
  const entries = JSON.parse(raw) as UploadManifestEntry[];
  return new Set(
    entries
      .filter((entry) => Number(entry.contentFolder) > 0)
      .filter((entry) => (entry.uploaded?.length ?? 0) > 0)
      .map((entry) => entry.contentFolder)
  );
}

async function readImportedFolderSet() {
  const links = await db.contentDownloadLink.findMany({
    select: { url: true }
  });

  const set = new Set<string>();
  for (const item of links) {
    const matched = item.url.match(/^https:\/\/t\.me\/Koikatunews\/(\d+)$/i);
    if (matched?.[1]) {
      set.add(matched[1]);
    }
  }

  return set;
}

async function listCleanFolders() {
  if (!existsSync(cleanRoot)) {
    throw new Error(`Clean root not found: ${cleanRoot}`);
  }

  const entries = await readdir(cleanRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => Number(a) - Number(b));
}

async function resolveAvailableDestination(folder: string) {
  let candidate = path.join(laterRoot, folder);
  if (!existsSync(candidate)) {
    return candidate;
  }

  let counter = 2;
  while (existsSync(candidate)) {
    candidate = path.join(laterRoot, `${folder}-${counter}`);
    counter += 1;
  }

  return candidate;
}

async function main() {
  const apply = hasApplyFlag();
  await mkdir(laterRoot, { recursive: true });

  const [folders, uploadedSet, importedSet] = await Promise.all([
    listCleanFolders(),
    readUploadedFolderSet(),
    readImportedFolderSet()
  ]);

  const candidates = folders.filter((folder) => !uploadedSet.has(folder) && !importedSet.has(folder));

  console.log(`[LATER] clean folders: ${folders.length}`);
  console.log(`[LATER] unuploaded + not-imported candidates: ${candidates.length}`);

  if (!candidates.length) {
    console.log("[LATER] nothing to move.");
    return;
  }

  if (!apply) {
    console.log("[LATER] dry-run mode. Add --apply to move folders.");
    for (const folder of candidates) {
      console.log(` - ${folder}`);
    }
    return;
  }

  for (const folder of candidates) {
    const sourcePath = path.join(cleanRoot, folder);
    const destinationPath = await resolveAvailableDestination(folder);
    await rename(sourcePath, destinationPath);
    console.log(`[LATER] moved ${folder} -> ${path.basename(destinationPath)}`);
  }

  console.log(`[LATER] done. moved ${candidates.length} folder(s) to ${laterRoot}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
