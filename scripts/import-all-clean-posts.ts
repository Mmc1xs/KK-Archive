import "./load-env";
import { existsSync } from "fs";
import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { Tag } from "@prisma/client";
import { db } from "../lib/db";
import { importCleanPost } from "./import-clean-post";

const cleanRoot = path.resolve(process.cwd(), "db image", "clean");
const reportsRoot = path.resolve(process.cwd(), "scripts", "reports");

async function writeReport(prefix: string, payload: unknown) {
  await mkdir(reportsRoot, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const latestPath = path.join(reportsRoot, `${prefix}.latest.json`);
  const timestampedPath = path.join(reportsRoot, `${prefix}.${stamp}.json`);
  const body = JSON.stringify(payload, null, 2);

  await writeFile(latestPath, body, "utf8");
  await writeFile(timestampedPath, body, "utf8");

  return { latestPath, timestampedPath };
}

async function main() {
  if (!existsSync(cleanRoot)) {
    throw new Error(`Clean root not found: ${cleanRoot}`);
  }

  const entries = await readdir(cleanRoot, { withFileTypes: true });
  const folders = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => Number(a) - Number(b));

  const importableFolders: string[] = [];
  const skipped: Array<{ folder: string; reason: string }> = [];

  for (const folder of folders) {
    const postPath = path.join(cleanRoot, folder, "post.json");
    if (!existsSync(postPath)) {
      skipped.push({ folder, reason: "post.json not found" });
      continue;
    }

    JSON.parse(await readFile(postPath, "utf8"));
    importableFolders.push(folder);
  }

  const imported: Array<{ folder: string; contentId: number; slug: string; title: string; mode: "imported" | "updated" }> = [];
  const failed: Array<{ folder: string; reason: string }> = [];
  const authorTagCache = new Map<string, Tag>();
  const typeTagCache = new Map<string, Pick<Tag, "id" | "name">>();

  console.log(`[SYNC:ALL][IMPORT] pending ${importableFolders.length} folder(s)`);

  for (const [index, folder] of importableFolders.entries()) {
    const label = `[SYNC:ALL][IMPORT ${index + 1}/${importableFolders.length}] folder ${folder}`;
    const startedAt = Date.now();
    console.log(`${label} start`);

    try {
      const result = await importCleanPost(folder, {
        logResult: false,
        authorTagCache,
        typeTagCache
      });
      imported.push({
        folder,
        contentId: result.contentId,
        slug: result.slug,
        title: result.title,
        mode: result.updated ? "updated" : "imported"
      });
      console.log(`${label} done in ${Date.now() - startedAt}ms -> ${result.updated ? "updated" : "imported"} "${result.title}"`);
    } catch (error) {
      const reason = error instanceof Error ? error.stack ?? error.message : String(error);
      failed.push({ folder, reason });
      console.error(`${label} failed in ${Date.now() - startedAt}ms`);
    }
  }

  const summary = {
    totalFolders: folders.length,
    readyFolders: importableFolders.length,
    importedFolders: imported.length,
    skippedCount: skipped.length,
    failedCount: failed.length
  };

  const reportPaths = await writeReport("clean-import-all-report", {
    ...summary,
    skipped,
    imported,
    failed
  });

  console.log(`[SYNC:ALL][IMPORT] completed imported=${summary.importedFolders} failed=${summary.failedCount} skipped=${summary.skippedCount}`);
  console.log(`[SYNC:ALL][IMPORT] report saved: ${reportPaths.latestPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
