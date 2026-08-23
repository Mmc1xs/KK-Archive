import path from "node:path";
import { promises as fs } from "node:fs";

const PROJECT_ROOT = process.cwd();
const CUT_ROOT = path.resolve(PROJECT_ROOT, "db image", "cut");

function parseArgs(argv) {
  const result = { apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--apply") {
      result.apply = true;
      continue;
    }
    if (token === "--queue" || token === "--folder") {
      const value = argv[i + 1];
      if (!value) throw new Error(`Missing value for ${token}`);
      result[token.slice(2)] = value;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  if (!result.queue) throw new Error("Missing --queue <queue-file>");
  if (!result.folder) throw new Error("Missing --folder <shared-cut-folder>");
  return result;
}

function assertInsideCutRoot(targetPath, label) {
  const relative = path.relative(CUT_ROOT, targetPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must be a child of db image/cut: ${targetPath}`);
  }
}

function sanitizeFolderSegment(value) {
  const sanitized = value
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim();
  if (!sanitized) throw new Error(`Invalid character folder name: ${value}`);
  return sanitized;
}

async function listFileNames(folderPath) {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
}

function assertSameFiles(actual, expected, label) {
  const normalizedExpected = [...new Set(expected)].sort();
  if (actual.length !== normalizedExpected.length || actual.some((name, index) => name !== normalizedExpected[index])) {
    throw new Error(
      `${label} contains unexpected or missing files. Actual: ${JSON.stringify(actual)}; expected: ${JSON.stringify(normalizedExpected)}`
    );
  }
}

async function buildPlan(queue, sharedFolder) {
  if (!/^[^/\\]+$/.test(sharedFolder)) {
    throw new Error("--folder must be one direct child folder name");
  }

  const sourceRoot = path.join(CUT_ROOT, sharedFolder);
  const sourceDownloads = path.join(sourceRoot, "d");
  assertInsideCutRoot(sourceRoot, "Source folder");

  const items = queue.items.filter((item) => item.folder === sharedFolder);
  if (items.length < 2) {
    throw new Error(`Expected multiple queue items for '${sharedFolder}', found ${items.length}`);
  }

  const plan = items.map((item) => {
    const imageNames = item.imageFileNames?.map((name) => name.trim()).filter(Boolean) ?? [];
    const downloadNames = item.downloadFileNames?.map((name) => name.trim()).filter(Boolean) ?? [];
    const characterName = item.characterName?.trim();

    if (!characterName) throw new Error(`Queue item in '${sharedFolder}' is missing characterName`);
    if (imageNames.length !== 1) {
      throw new Error(`Queue item '${characterName}' must name exactly one preview image`);
    }
    if (downloadNames.length !== 1) {
      throw new Error(`Queue item '${characterName}' must name exactly one download file`);
    }

    const messageId = imageNames[0].match(/_(\d+)\.[^.]+$/)?.[1];
    if (!messageId) {
      throw new Error(`Cannot derive Telegram message id from preview filename: ${imageNames[0]}`);
    }

    const destinationFolder = `${messageId}-${sanitizeFolderSegment(characterName)}`;
    const destinationRoot = path.join(CUT_ROOT, destinationFolder);
    assertInsideCutRoot(destinationRoot, "Destination folder");

    return {
      item,
      characterName,
      imageName: imageNames[0],
      downloadName: downloadNames[0],
      destinationFolder,
      destinationRoot,
      sourceImage: path.join(sourceRoot, imageNames[0]),
      destinationImage: path.join(destinationRoot, imageNames[0]),
      sourceDownload: path.join(sourceDownloads, downloadNames[0]),
      destinationDownload: path.join(destinationRoot, "d", downloadNames[0])
    };
  });

  const destinationNames = plan.map((entry) => entry.destinationFolder);
  if (new Set(destinationNames).size !== destinationNames.length) {
    throw new Error("Destination folder names are not unique");
  }

  const rootEntries = await fs.readdir(sourceRoot, { withFileTypes: true });
  const unexpectedDirectories = rootEntries
    .filter((entry) => entry.isDirectory() && entry.name !== "d")
    .map((entry) => entry.name);
  if (unexpectedDirectories.length) {
    throw new Error(`Source folder contains unexpected directories: ${unexpectedDirectories.join(", ")}`);
  }

  assertSameFiles(
    await listFileNames(sourceRoot),
    plan.map((entry) => entry.imageName),
    "Preview folder"
  );
  assertSameFiles(
    await listFileNames(sourceDownloads),
    plan.map((entry) => entry.downloadName),
    "Download folder"
  );

  for (const entry of plan) {
    await fs.access(entry.sourceImage);
    await fs.access(entry.sourceDownload);
    try {
      await fs.access(entry.destinationRoot);
      throw new Error(`Destination already exists: ${entry.destinationFolder}`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  return { sourceRoot, sourceDownloads, plan };
}

async function applyPlan(queuePath, rawQueue, queue, splitPlan) {
  const completedMoves = [];
  const createdRoots = [];
  let queueChanged = false;

  try {
    for (const entry of splitPlan.plan) {
      await fs.mkdir(path.join(entry.destinationRoot, "d"), { recursive: true });
      createdRoots.push(entry.destinationRoot);

      await fs.rename(entry.sourceImage, entry.destinationImage);
      completedMoves.push([entry.destinationImage, entry.sourceImage]);

      await fs.rename(entry.sourceDownload, entry.destinationDownload);
      completedMoves.push([entry.destinationDownload, entry.sourceDownload]);

      entry.item.folder = entry.destinationFolder;
    }

    const queueTemp = `${queuePath}.split.tmp`;
    await fs.writeFile(queueTemp, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
    await fs.rename(queueTemp, queuePath);
    queueChanged = true;

    await fs.rmdir(splitPlan.sourceDownloads);
    await fs.rmdir(splitPlan.sourceRoot);
  } catch (error) {
    if (queueChanged) {
      await fs.writeFile(queuePath, rawQueue, "utf8");
    }

    for (const [currentPath, originalPath] of completedMoves.reverse()) {
      try {
        await fs.rename(currentPath, originalPath);
      } catch {
        // Preserve the first operational error; verification will reveal any rollback problem.
      }
    }

    for (const root of createdRoots.reverse()) {
      try {
        await fs.rmdir(path.join(root, "d"));
        await fs.rmdir(root);
      } catch {
        // Preserve the first operational error.
      }
    }

    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const queuePath = path.resolve(PROJECT_ROOT, args.queue);
  assertInsideCutRoot(queuePath, "Queue file");

  const rawQueue = await fs.readFile(queuePath, "utf8");
  const queue = JSON.parse(rawQueue.replace(/^\uFEFF/, ""));
  if (!Array.isArray(queue.items)) throw new Error("Queue file must contain an items array");

  const splitPlan = await buildPlan(queue, args.folder);
  const summary = splitPlan.plan.map((entry) => ({
    from: args.folder,
    to: entry.destinationFolder,
    preview: entry.imageName,
    download: entry.downloadName
  }));

  if (!args.apply) {
    console.log(JSON.stringify({ mode: "dry-run", count: summary.length, items: summary }, null, 2));
    return;
  }

  await applyPlan(queuePath, rawQueue, queue, splitPlan);
  console.log(JSON.stringify({ mode: "apply", count: summary.length, items: summary }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
