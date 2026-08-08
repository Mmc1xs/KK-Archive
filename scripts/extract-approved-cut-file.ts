import path from "path";
import { existsSync, promises as fs } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { cutRoot, workflowRoot } from "./workflow-paths";

const execFileAsync = promisify(execFile);

function parseArgs() {
  const args = process.argv.slice(2);
  let archive = "";
  let entry = "";
  let output = "";

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--archive") archive = args[++i] ?? "";
    else if (args[i] === "--entry") entry = args[++i] ?? "";
    else if (args[i] === "--output") output = args[++i] ?? "";
    else throw new Error(`Unsupported argument: ${args[i]}`);
  }

  if (!archive || !entry || !output) {
    throw new Error("Required: --archive <path> --entry <archive entry> --output <folder>");
  }
  return { archive, entry, output };
}

function assertWithin(base: string, target: string, label: string) {
  const relative = path.relative(base, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} is outside allowed root`);
  }
}

async function main() {
  const args = parseArgs();
  const root = workflowRoot;
  const archiveRoot = path.resolve(cutRoot, "_source-downloads");
  const archivePath = path.resolve(root, args.archive);
  const outputPath = path.resolve(root, args.output);

  assertWithin(archiveRoot, archivePath, "archive");
  assertWithin(cutRoot, outputPath, "output");
  if (!existsSync(archivePath)) throw new Error(`Archive not found: ${args.archive}`);

  await fs.mkdir(outputPath, { recursive: true });
  const { stdout, stderr } = await execFileAsync("7z", [
    "e",
    archivePath,
    args.entry,
    `-o${outputPath}`,
    "-y"
  ], { windowsHide: true });

  const files = (await fs.readdir(outputPath, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "en"));

  console.log(JSON.stringify({
    archive: args.archive,
    entry: args.entry,
    output: args.output,
    files,
    stdout: stdout.trim(),
    stderr: stderr.trim()
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
