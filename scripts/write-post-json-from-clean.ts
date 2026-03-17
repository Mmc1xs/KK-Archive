import "./load-env";
import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { PublishStatus } from "@prisma/client";

type EnrichedCleanImportCandidate = {
  folder: string;
  anchorMessageId: number;
  pixivArtworkUrl: string | null;
  pixivArtworkId: string | null;
  imagePaths: string[];
  coverImagePath: string | null;
  rawText: string;
  sourceMetaPath: string;
  pixivTitle: string | null;
  pixivAuthorName: string | null;
  pixivImageUrls: string[];
  pixivFetchError: string | null;
};

type R2UploadManifestEntry = {
  contentFolder: string;
  anchorMessageId: number;
  sourceMetaPath: string;
  uploaded: Array<{
    sourcePath: string;
    objectKey: string;
    publicUrl: string;
  }>;
};

type PostJson = {
  source: {
    cleanFolder: string;
    anchorMessageId: number;
    telegramPostUrl: string;
    pixivArtworkUrl: string | null;
    pixivArtworkId: string | null;
    sourceMetaPath: string;
    localImagePaths: string[];
    r2ImageUrls: string[];
  };
  post: {
    title: string | null;
    authorName: string | null;
    typeName: string | null;
    sourceLink: string | null;
    publishStatus: PublishStatus;
    coverImageUrl: string | null;
    imageUrls: string[];
    downloadLinks: string[];
    description: string;
  };
  importStatus: {
    ready: boolean;
    reason: string | null;
    pixivFetchError: string | null;
  };
};

const enrichedManifestPath = path.resolve(process.cwd(), "scripts", "clean-import-manifest.enriched.json");
const r2ManifestPath = path.resolve(process.cwd(), "scripts", "r2-upload-manifest.json");
const cleanRoot = path.resolve(process.cwd(), process.env.CLEAN_IMAGE_ROOT || "db image/clean");

const paidPatterns = [
  /#付费卡/u,
  /#付費卡/u,
  /#莉倩ｴｹ蜊｡/u,
  /#莉倩ｲｻ蜊｡/u,
  /#闔牙ｩ・ｴ・ｹ陷奇ｽ｡/u,
  /#闔牙ｩ・ｲ・ｻ陷奇ｽ｡/u
];

const exactExcludedLines = new Set([
  "#人物卡",
  "#人物卡片",
  "#莠ｺ迚ｩ蜊｡",
  "#闔・ｺ霑夲ｽｩ陷奇ｽ｡",
  "卡片下载",
  "人物下載",
  "角色下载"
]);

const fragmentExclusions = [
  "蜊｡迚",
  "download",
  "tips",
  "卡片下载",
  "人物下載",
  "角色下载",
  "download link",
  "付费卡购买",
  "箝撰ｸ城｢鷹％tips",
  "笨茨ｸ",
  "譬・ｭｾ蟇ｼ闊ｪ"
];

function buildTelegramPostUrl(folder: string) {
  return `https://t.me/Koikatunews/${folder}`;
}

function hasPaidTag(rawText: string) {
  return paidPatterns.some((pattern) => pattern.test(rawText));
}

function extractTypeName(rawText: string) {
  if (/#服裝卡/u.test(rawText) || /#服装卡/u.test(rawText)) {
    return "Cloth card";
  }

  return "Character card";
}

function normalizeDescriptionLine(line: string) {
  return line.replace(/\s+/g, " ").trim();
}

function shouldExcludeLine(line: string, pixivArtworkUrl: string | null) {
  const normalized = normalizeDescriptionLine(line);
  if (!normalized) {
    return true;
  }
  if (normalized === pixivArtworkUrl) {
    return true;
  }
  if (exactExcludedLines.has(normalized)) {
    return true;
  }
  if (/^https?:\/\/www\.pixiv\.net\/artworks\/\d+$/i.test(normalized)) {
    return true;
  }
  return fragmentExclusions.some((fragment) => normalized.toLowerCase().includes(fragment.toLowerCase()));
}

function buildDescription(rawText: string, pixivArtworkUrl: string | null) {
  return rawText
    .split(/\r?\n/)
    .map((line) => normalizeDescriptionLine(line))
    .filter((line) => !shouldExcludeLine(line, pixivArtworkUrl))
    .join("\n");
}

function buildPostJson(candidate: EnrichedCleanImportCandidate, r2Entry?: R2UploadManifestEntry): PostJson {
  const telegramPostUrl = buildTelegramPostUrl(candidate.folder);
  const imageUrls = (r2Entry?.uploaded ?? []).map((item) => item.publicUrl).slice(0, 3);
  const ready = imageUrls.length > 0;

  return {
    source: {
      cleanFolder: candidate.folder,
      anchorMessageId: candidate.anchorMessageId,
      telegramPostUrl,
      pixivArtworkUrl: candidate.pixivArtworkUrl,
      pixivArtworkId: candidate.pixivArtworkId,
      sourceMetaPath: candidate.sourceMetaPath,
      localImagePaths: candidate.imagePaths,
      r2ImageUrls: imageUrls
    },
    post: {
      title: candidate.pixivTitle,
      authorName: candidate.pixivAuthorName,
      typeName: extractTypeName(candidate.rawText),
      sourceLink: candidate.pixivArtworkUrl,
      publishStatus: hasPaidTag(candidate.rawText) ? PublishStatus.SUMMIT : PublishStatus.PUBLISHED,
      coverImageUrl: imageUrls[0] ?? null,
      imageUrls,
      downloadLinks: [telegramPostUrl],
      description: buildDescription(candidate.rawText, candidate.pixivArtworkUrl)
    },
    importStatus: {
      ready,
      reason: ready ? null : "Missing R2 image URLs",
      pixivFetchError: candidate.pixivFetchError
    }
  };
}

async function main() {
  if (!existsSync(enrichedManifestPath)) {
    throw new Error(`Enriched manifest not found: ${enrichedManifestPath}`);
  }
  if (!existsSync(r2ManifestPath)) {
    throw new Error(`R2 upload manifest not found: ${r2ManifestPath}. Run npm run r2:upload-clean first.`);
  }

  const enriched = JSON.parse(await readFile(enrichedManifestPath, "utf8")) as EnrichedCleanImportCandidate[];
  const r2Manifest = JSON.parse(await readFile(r2ManifestPath, "utf8")) as R2UploadManifestEntry[];
  const r2Map = new Map(r2Manifest.map((entry) => [entry.contentFolder, entry]));

  for (const candidate of enriched) {
    const folderPath = path.join(cleanRoot, candidate.folder);
    const outPath = path.join(folderPath, "post.json");
    const postJson = buildPostJson(candidate, r2Map.get(candidate.folder));

    await writeFile(outPath, JSON.stringify(postJson, null, 2), "utf8");
    console.log(`Wrote ${outPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
