import path from "path";
import { existsSync, promises as fs } from "fs";
import { workflowRoot } from "./workflow-paths";

function parseArgs() {
  const args = process.argv.slice(2);
  const values: string[] = [];
  let apply = false;
  let allowCutFolder = false;
  let allowVioletFolder = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg === "--allow-cut-folder") {
      allowCutFolder = true;
      continue;
    }
    if (arg === "--allow-violet-folder") {
      allowVioletFolder = true;
      continue;
    }
    if (arg === "--path") {
      const value = args[i + 1];
      if (!value) throw new Error("--path requires a value");
      values.push(value);
      i += 1;
      continue;
    }
    throw new Error(`Unsupported argument: ${arg}`);
  }

  if (values.length === 0) throw new Error("Provide at least one --path");
  return { apply, allowCutFolder, allowVioletFolder, values };
}

function resolveAllowedPath(input: string, allowCutFolder: boolean, allowVioletFolder: boolean) {
  const root = workflowRoot;
  const target = path.resolve(root, input);
  const allowedRoots = [
    path.resolve(root, "db image", "output"),
    path.resolve(root, "db image", "cut", "_source-downloads")
  ];

  let allowed = allowedRoots.some((allowedRoot) => {
    const relative = path.relative(allowedRoot, target);
    return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
  });

  if (!allowed && allowCutFolder) {
    const cutRoot = path.resolve(root, "db image", "cut");
    const relative = path.relative(cutRoot, target);
    const parts = relative.split(path.sep).filter(Boolean);
    allowed =
      parts.length === 1 &&
      !relative.startsWith("..") &&
      !path.isAbsolute(relative) &&
      /^\d{5,}(?:[-_].+)?$/.test(parts[0]);
  }

  if (!allowed && allowVioletFolder) {
    const violetRoot = path.resolve(root, "db image", "cut", "violet2025");
    const relative = path.relative(violetRoot, target);
    const parts = relative.split(path.sep).filter(Boolean);
    allowed =
      parts.length === 1 &&
      !relative.startsWith("..") &&
      !path.isAbsolute(relative) &&
      /^\d{5,}(?:[-_].+)?$/.test(parts[0]);
  }

  if (!allowed) {
    throw new Error(`Refusing to remove path outside allowed temporary roots: ${input}`);
  }

  return target;
}

async function describe(target: string) {
  if (!existsSync(target)) return { exists: false, files: 0, bytes: 0 };
  const stat = await fs.stat(target);
  if (stat.isFile()) return { exists: true, files: 1, bytes: stat.size };

  let files = 0;
  let bytes = 0;
  async function walk(folder: string): Promise<void> {
    for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
      const fullPath = path.join(folder, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      else if (entry.isFile()) {
        files += 1;
        bytes += (await fs.stat(fullPath)).size;
      }
    }
  }
  await walk(target);
  return { exists: true, files, bytes };
}

async function main() {
  const { apply, allowCutFolder, allowVioletFolder, values } = parseArgs();
  const results = [];

  for (const value of values) {
    const target = resolveAllowedPath(value, allowCutFolder, allowVioletFolder);
    const before = await describe(target);
    if (apply && before.exists) {
      await fs.rm(target, { recursive: true, force: true });
    }
    const after = await describe(target);
    results.push({ path: value, target, before, after, action: apply ? "removed" : "dry-run" });
  }

  console.log(JSON.stringify({ apply, allowCutFolder, allowVioletFolder, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
