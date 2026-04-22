import { promises as fs } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const nextConfigPath = path.join(projectRoot, "next.config.ts");
const scanRoots = ["app", "components"];
const scanExts = new Set([".ts", ".tsx", ".js", ".jsx"]);

async function walkFiles(dirPath, collected) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(fullPath, collected);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (scanExts.has(ext)) {
      collected.push(fullPath);
    }
  }
}

function toProjectPath(filePath) {
  return path.relative(projectRoot, filePath).replaceAll("\\", "/");
}

async function main() {
  const failures = [];
  const warnings = [];

  const nextConfig = await fs.readFile(nextConfigPath, "utf8");
  const hasUnoptimizedTrue = /images\s*:\s*{[\s\S]*?unoptimized\s*:\s*true[\s\S]*?}/m.test(nextConfig);

  if (!hasUnoptimizedTrue) {
    failures.push(
      "next.config.ts is missing `images.unoptimized: true`."
    );
  }

  const sourceFiles = [];
  for (const root of scanRoots) {
    const absRoot = path.join(projectRoot, root);
    await walkFiles(absRoot, sourceFiles);
  }

  const imageImportFiles = [];
  const forceOptimizedFiles = [];
  for (const filePath of sourceFiles) {
    const content = await fs.readFile(filePath, "utf8");
    if (/from\s+["']next\/image["']/.test(content)) {
      imageImportFiles.push(filePath);
    }
    if (/unoptimized\s*=\s*\{?\s*false\s*\}?/.test(content)) {
      forceOptimizedFiles.push(filePath);
    }
  }

  if (forceOptimizedFiles.length > 0) {
    failures.push(
      [
        "Found explicit `unoptimized={false}` (forces paid image transformations):",
        ...forceOptimizedFiles.map((p) => `- ${toProjectPath(p)}`)
      ].join("\n")
    );
  }

  if (imageImportFiles.length > 0) {
    warnings.push(
      `Detected ${imageImportFiles.length} file(s) importing next/image. Global unoptimized mode is required to keep transformation cost at zero.`
    );
  }

  if (failures.length > 0) {
    console.error("Image cost guardrail check failed.\n");
    for (const failure of failures) {
      console.error(failure);
      console.error("");
    }
    process.exit(1);
  }

  console.log("Image cost guardrail check passed.");
  for (const warning of warnings) {
    console.log(`Warning: ${warning}`);
  }
}

main().catch((error) => {
  console.error("Image cost guardrail check crashed.");
  console.error(error);
  process.exit(1);
});
