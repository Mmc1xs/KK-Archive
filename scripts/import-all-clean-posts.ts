import "./load-env";
import { existsSync } from "fs";
import { readdir, readFile } from "fs/promises";
import path from "path";
import { spawnSync } from "child_process";

const cleanRoot = path.resolve(process.cwd(), "db image", "clean");

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

  const imported: string[] = [];
  const failed: Array<{ folder: string; reason: string }> = [];

  for (const folder of importableFolders) {
    const result = spawnSync("npx", ["tsx", "scripts/import-clean-post.ts", folder], {
      cwd: process.cwd(),
      encoding: "utf8",
      shell: process.platform === "win32"
    });

    if (result.status === 0) {
      imported.push(folder);
      console.log(result.stdout.trim());
      continue;
    }

    failed.push({
      folder,
      reason: (result.stderr || result.stdout || "Unknown import error").trim()
    });
  }

  console.log(
    JSON.stringify(
      {
        totalFolders: folders.length,
        readyFolders: importableFolders.length,
        importedFolders: imported.length,
        skippedCount: skipped.length,
        failedCount: failed.length,
        skipped,
        failed
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
