import path from "node:path";
import { promises as fs } from "node:fs";

const PROJECT_ROOT = process.cwd();
const CUT_ROOT = path.resolve(PROJECT_ROOT, "db image", "cut");
const ALLOWED_EXTENSIONS = new Set([".zipmod", ".zip", ".7z", ".rar", ".tmp"]);

function parseArgs(argv) {
  const paths = [];
  let apply = false;
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--apply") {
      apply = true;
      continue;
    }
    if (token === "--path") {
      const value = argv[i + 1];
      if (!value) throw new Error("--path requires a value");
      paths.push(value);
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  if (!paths.length) throw new Error("Provide at least one exact --path");
  return { apply, paths };
}

function resolveAllowedSourceFile(input) {
  const target = path.resolve(PROJECT_ROOT, input);
  const relative = path.relative(CUT_ROOT, target);
  const parts = relative.split(path.sep).filter(Boolean);

  if (
    parts.length !== 1 ||
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !ALLOWED_EXTENSIONS.has(path.extname(parts[0]).toLowerCase())
  ) {
    throw new Error(`Refusing non-source or non-root cut path: ${input}`);
  }

  return target;
}

async function describe(target) {
  try {
    const stat = await fs.lstat(target);
    if (!stat.isFile()) throw new Error(`Refusing to remove non-file path: ${target}`);
    return { exists: true, bytes: stat.size };
  } catch (error) {
    if (error?.code === "ENOENT") return { exists: false, bytes: 0 };
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const results = [];

  for (const input of args.paths) {
    const target = resolveAllowedSourceFile(input);
    const before = await describe(target);
    if (args.apply && before.exists) await fs.unlink(target);
    const after = await describe(target);
    results.push({
      path: input,
      target,
      before,
      after,
      action: args.apply ? "removed" : "dry-run"
    });
  }

  console.log(JSON.stringify({ apply: args.apply, results }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
