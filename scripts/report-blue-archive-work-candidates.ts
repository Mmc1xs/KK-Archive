import "./load-env";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

type ManifestCandidate = {
  folder: string;
  anchorMessageId: number;
  pixivArtworkUrl: string | null;
  pixivArtworkId: string | null;
  rawText: string;
  pixivTitle?: string | null;
  pixivAuthorName?: string | null;
};

type WorkAliasEntry = {
  canonicalName: string;
  canonicalSlug: string;
  aliases: string[];
};

type WorkAliasFile = {
  version: number;
  updatedAt: string;
  entries: WorkAliasEntry[];
};

type MatchSource = "rawText" | "pixivTitle";

type CandidateMatch = {
  folder: string;
  anchorMessageId: number;
  pixivArtworkUrl: string;
  pixivArtworkId: string | null;
  pixivTitle: string | null;
  pixivAuthorName: string | null;
  rawTextHashtags: string[];
  matchedAliases: Array<{
    source: MatchSource;
    alias: string;
  }>;
};

type BlueArchiveCandidateReport = {
  generatedAt: string;
  canonicalName: string;
  canonicalSlug: string;
  totalPixivArtworkCandidates: number;
  matchedCount: number;
  rawTextOnlyCount: number;
  titleOnlyCount: number;
  rawTextAndTitleCount: number;
  matched: CandidateMatch[];
  rawTextOnly: CandidateMatch[];
  titleOnly: CandidateMatch[];
  rawTextAndTitle: CandidateMatch[];
};

const aliasPath = path.resolve(process.cwd(), "scripts", "pixiv-work-aliases.json");
const enrichedManifestPath = path.resolve(process.cwd(), "scripts", "clean-import-manifest.enriched.json");
const baseManifestPath = path.resolve(process.cwd(), "scripts", "clean-import-manifest.json");
const reportsDir = path.resolve(process.cwd(), "scripts", "reports");

function normalizeValue(value: string) {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/gu, " ");
}

function isPixivArtworkUrl(url: string | null) {
  return typeof url === "string" && /pixiv\.net\/artworks\/\d+/u.test(url);
}

function extractHashtags(rawText: string) {
  const matches = rawText.matchAll(/#([^\s#]+)/gu);
  return Array.from(matches, (match) => match[1]).filter(Boolean);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function buildAliasMatchers(entry: WorkAliasEntry) {
  const normalizedAliases = uniqueStrings(
    entry.aliases
      .map((alias) => alias.trim())
      .filter(Boolean)
      .map((alias) => normalizeValue(alias))
  );

  const hashtagAliases = new Set(normalizedAliases);
  const titleAliases = normalizedAliases.filter((alias) => alias.length >= 4 || /[^\u0000-\u007f]/u.test(alias));

  return { hashtagAliases, titleAliases };
}

function matchesBlueArchive(
  candidate: ManifestCandidate,
  entry: WorkAliasEntry
): CandidateMatch | null {
  if (!candidate.pixivArtworkUrl || !isPixivArtworkUrl(candidate.pixivArtworkUrl)) {
    return null;
  }

  const { hashtagAliases, titleAliases } = buildAliasMatchers(entry);
  const hashtags = extractHashtags(candidate.rawText);
  const normalizedHashtags = hashtags.map((tag) => normalizeValue(tag));
  const normalizedTitle = normalizeValue(candidate.pixivTitle ?? "");
  const matchedAliases: CandidateMatch["matchedAliases"] = [];

  normalizedHashtags.forEach((tag, index) => {
    if (hashtagAliases.has(tag)) {
      matchedAliases.push({
        source: "rawText",
        alias: hashtags[index]
      });
    }
  });

  titleAliases.forEach((alias) => {
    if (normalizedTitle.includes(alias)) {
      matchedAliases.push({
        source: "pixivTitle",
        alias
      });
    }
  });

  if (matchedAliases.length === 0) {
    return null;
  }

  return {
    folder: candidate.folder,
    anchorMessageId: candidate.anchorMessageId,
    pixivArtworkUrl: candidate.pixivArtworkUrl,
    pixivArtworkId: candidate.pixivArtworkId ?? null,
    pixivTitle: candidate.pixivTitle ?? null,
    pixivAuthorName: candidate.pixivAuthorName ?? null,
    rawTextHashtags: hashtags,
    matchedAliases
  };
}

async function loadManifest() {
  const inputPath = existsSync(enrichedManifestPath) ? enrichedManifestPath : baseManifestPath;
  if (!existsSync(inputPath)) {
    throw new Error(`Manifest not found: ${inputPath}`);
  }

  return JSON.parse(await readFile(inputPath, "utf8")) as ManifestCandidate[];
}

async function loadBlueArchiveAlias() {
  if (!existsSync(aliasPath)) {
    throw new Error(`Alias file not found: ${aliasPath}`);
  }

  const aliasFile = JSON.parse(await readFile(aliasPath, "utf8")) as WorkAliasFile;
  const blueArchive = aliasFile.entries.find(
    (entry) =>
      entry.canonicalSlug === "blue-archive" ||
      normalizeValue(entry.canonicalName) === "blue archive"
  );

  if (!blueArchive) {
    throw new Error("Blue Archive alias entry was not found in scripts/pixiv-work-aliases.json");
  }

  return blueArchive;
}

async function main() {
  const [manifest, blueArchive] = await Promise.all([loadManifest(), loadBlueArchiveAlias()]);
  const pixivCandidates = manifest.filter((candidate) => isPixivArtworkUrl(candidate.pixivArtworkUrl));
  const matches = pixivCandidates
    .map((candidate) => matchesBlueArchive(candidate, blueArchive))
    .filter((candidate): candidate is CandidateMatch => candidate !== null)
    .sort((left, right) => Number(left.folder) - Number(right.folder));

  const rawTextOnly = matches.filter(
    (candidate) =>
      candidate.matchedAliases.some((match) => match.source === "rawText") &&
      !candidate.matchedAliases.some((match) => match.source === "pixivTitle")
  );
  const titleOnly = matches.filter(
    (candidate) =>
      candidate.matchedAliases.some((match) => match.source === "pixivTitle") &&
      !candidate.matchedAliases.some((match) => match.source === "rawText")
  );
  const rawTextAndTitle = matches.filter(
    (candidate) =>
      candidate.matchedAliases.some((match) => match.source === "rawText") &&
      candidate.matchedAliases.some((match) => match.source === "pixivTitle")
  );

  const report: BlueArchiveCandidateReport = {
    generatedAt: new Date().toISOString(),
    canonicalName: blueArchive.canonicalName,
    canonicalSlug: blueArchive.canonicalSlug,
    totalPixivArtworkCandidates: pixivCandidates.length,
    matchedCount: matches.length,
    rawTextOnlyCount: rawTextOnly.length,
    titleOnlyCount: titleOnly.length,
    rawTextAndTitleCount: rawTextAndTitle.length,
    matched: matches,
    rawTextOnly,
    titleOnly,
    rawTextAndTitle
  };

  await mkdir(reportsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
  const latestPath = path.join(reportsDir, "blue-archive-work-candidates.latest.json");
  const datedPath = path.join(reportsDir, `blue-archive-work-candidates.${timestamp}.json`);

  await writeFile(latestPath, JSON.stringify(report, null, 2), "utf8");
  await writeFile(datedPath, JSON.stringify(report, null, 2), "utf8");

  console.log(`[WORK:BLUE-ARCHIVE] pixiv artwork candidates: ${report.totalPixivArtworkCandidates}`);
  console.log(`[WORK:BLUE-ARCHIVE] matched: ${report.matchedCount}`);
  console.log(`[WORK:BLUE-ARCHIVE] rawText only: ${report.rawTextOnlyCount}`);
  console.log(`[WORK:BLUE-ARCHIVE] title only: ${report.titleOnlyCount}`);
  console.log(`[WORK:BLUE-ARCHIVE] rawText + title: ${report.rawTextAndTitleCount}`);
  console.log(`[WORK:BLUE-ARCHIVE] latest report: ${latestPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
