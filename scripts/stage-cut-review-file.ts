import path from "node:path";
import { constants } from "node:fs";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { cutRoot, dbImageRoot, workflowRoot } from "./workflow-paths";

const LARGE_FILE_LIMIT_BYTES = 200 * 1024 * 1024;

function parseArgs() {
  const args = process.argv.slice(2);
  let source = "";
  let folder = "";

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--source") {
      source = args[++index] ?? "";
    } else if (args[index] === "--folder") {
      folder = args[++index] ?? "";
    } else {
      throw new Error(`Unsupported argument: ${args[index]}`);
    }
  }

  if (!source.trim()) throw new Error("--source is required");
  if (!folder.trim()) throw new Error("--folder is required");
  return { source: source.trim(), folder: folder.trim() };
}

function resolveWithin(base: string, candidate: string, label: string) {
  const target = path.resolve(base, candidate);
  const relative = path.relative(base, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Unsafe ${label}: ${candidate}`);
  }
  return target;
}

async function main() {
  const { source, folder } = parseArgs();
  const root = workflowRoot;
  const outputRoot = path.resolve(dbImageRoot, "output");
  const sourcePath = resolveWithin(outputRoot, source, "source");
  const contentFolder = resolveWithin(cutRoot, folder, "folder");
  const sourceInfo = await stat(sourcePath);

  if (!sourceInfo.isFile()) throw new Error(`Source is not a file: ${source}`);
  if (sourceInfo.size > LARGE_FILE_LIMIT_BYTES) {
    throw new Error(
      `Large file exceeds 200MB and must not be staged locally. Report it and use the owner-provided KK Archive mod link instead: ${source} (${sourceInfo.size} bytes)`
    );
  }

  const destinationFolder = path.join(contentFolder, "d");
  const destinationPath = path.join(destinationFolder, path.basename(sourcePath));
  await mkdir(destinationFolder, { recursive: true });
  await copyFile(sourcePath, destinationPath, constants.COPYFILE_EXCL);

  console.log(JSON.stringify({
    source: path.relative(root, sourcePath),
    destination: path.relative(root, destinationPath),
    bytes: sourceInfo.size
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
