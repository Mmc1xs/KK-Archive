import "./load-env";
import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { spawnSync } from "child_process";
import { db } from "../lib/db";

type EnrichedCleanImportCandidate = {
  folder: string;
};

type R2UploadManifestEntry = {
  contentFolder: string;
};

const enrichedManifestPath = path.resolve(process.cwd(), "scripts", "clean-import-manifest.enriched.json");
const r2ManifestPath = path.resolve(process.cwd(), "scripts", "r2-upload-manifest.json");

function runPostJsonGeneration() {
  const result = spawnSync("npx", ["tsx", "scripts/write-post-json-from-clean.ts"], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32"
  });

  if (result.stdout.trim()) {
    console.log(result.stdout.trim());
  }

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "clean:post-json failed").trim());
  }
}

async function main() {
  if (!existsSync(enrichedManifestPath)) {
    throw new Error(`Enriched manifest not found: ${enrichedManifestPath}`);
  }

  if (!existsSync(r2ManifestPath)) {
    throw new Error(`R2 upload manifest not found: ${r2ManifestPath}`);
  }

  const existingLinks = await db.contentDownloadLink.findMany({
    select: { url: true }
  });
  const existingLinkSet = new Set(existingLinks.map((item) => item.url));

  const enrichedRaw = await readFile(enrichedManifestPath, "utf8");
  const r2Raw = await readFile(r2ManifestPath, "utf8");

  const enriched = JSON.parse(enrichedRaw) as EnrichedCleanImportCandidate[];
  const r2Manifest = JSON.parse(r2Raw) as R2UploadManifestEntry[];

  const pendingFolderSet = new Set(
    enriched
      .filter((candidate) => !existingLinkSet.has(`https://t.me/Koikatunews/${candidate.folder}`))
      .map((candidate) => candidate.folder)
  );

  const filteredEnriched = enriched.filter((candidate) => pendingFolderSet.has(candidate.folder));
  const filteredR2Manifest = r2Manifest.filter((entry) => pendingFolderSet.has(entry.contentFolder));

  await writeFile(enrichedManifestPath, JSON.stringify(filteredEnriched, null, 2), "utf8");
  await writeFile(r2ManifestPath, JSON.stringify(filteredR2Manifest, null, 2), "utf8");

  try {
    runPostJsonGeneration();
    console.log(`Updated ${pendingFolderSet.size} new folder(s).`);
  } finally {
    await writeFile(enrichedManifestPath, enrichedRaw, "utf8");
    await writeFile(r2ManifestPath, r2Raw, "utf8");
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
