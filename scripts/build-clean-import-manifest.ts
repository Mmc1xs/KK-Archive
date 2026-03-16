import "./load-env";
import { existsSync } from "fs";
import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import path from "path";

type CleanMeta = {
  mode: "group" | "single";
  anchor_message_id: number;
  grouped_id: number | null;
  message_ids: number[];
  downloaded: Array<{
    message_id: number;
    path: string;
  }>;
  text?: string;
};

type CleanImportCandidate = {
  folder: string;
  anchorMessageId: number;
  pixivArtworkUrl: string | null;
  pixivArtworkId: string | null;
  imagePaths: string[];
  coverImagePath: string | null;
  rawText: string;
  sourceMetaPath: string;
};

const cleanRoot = path.resolve(process.cwd(), process.env.CLEAN_IMAGE_ROOT || "db image/clean");
const outPath = path.resolve(process.cwd(), "scripts", "clean-import-manifest.json");

function extractPixivArtworkUrl(text: string) {
  const match = text.match(/https?:\/\/www\.pixiv\.net\/artworks\/(\d+)/i);
  if (!match) {
    return { url: null, artworkId: null };
  }

  return {
    url: match[0],
    artworkId: match[1]
  };
}

async function main() {
  if (!existsSync(cleanRoot)) {
    throw new Error(`Clean root not found: ${cleanRoot}`);
  }

  const folders = (await readdir(cleanRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => Number(a) - Number(b));

  const candidates: CleanImportCandidate[] = [];

  for (const folder of folders) {
    const metaPath = path.join(cleanRoot, folder, "_meta.json");
    if (!existsSync(metaPath)) {
      continue;
    }

    const meta = JSON.parse(await readFile(metaPath, "utf8")) as CleanMeta;
    const rawText = meta.text || "";
    const { url, artworkId } = extractPixivArtworkUrl(rawText);

    const imagePaths = meta.downloaded
      .map((item) => path.join(cleanRoot, folder, path.basename(item.path)))
      .filter((imagePath) => existsSync(imagePath));

    candidates.push({
      folder,
      anchorMessageId: meta.anchor_message_id,
      pixivArtworkUrl: url,
      pixivArtworkId: artworkId,
      imagePaths,
      coverImagePath: imagePaths[0] ?? null,
      rawText,
      sourceMetaPath: metaPath
    });
  }

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(candidates, null, 2), "utf8");
  console.log(`Built ${candidates.length} clean import candidates -> ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
