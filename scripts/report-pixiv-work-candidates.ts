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

type WorkMatch = {
  canonicalName: string;
  canonicalSlug: string;
  matchedAliases: Array<{
    source: MatchSource;
    alias: string;
  }>;
};

type CandidateMatch = {
  folder: string;
  anchorMessageId: number;
  pixivArtworkUrl: string;
  pixivArtworkId: string | null;
  pixivTitle: string | null;
  pixivAuthorName: string | null;
  rawTextHashtags: string[];
  work: WorkMatch;
};

type AmbiguousCandidate = Omit<CandidateMatch, "work"> & {
  works: WorkMatch[];
};

type WorkCandidateReport = {
  generatedAt: string;
  totalPixivArtworkCandidates: number;
  matchedCount: number;
  ambiguousCount: number;
  unmatchedCount: number;
  matched: CandidateMatch[];
  ambiguous: AmbiguousCandidate[];
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

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function titleContainsAlias(normalizedTitle: string, alias: string) {
  if (!normalizedTitle || !alias) {
    return false;
  }

  if (/[^\u0000-\u007f]/u.test(alias)) {
    return normalizedTitle.includes(alias);
  }

  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(alias)}([^a-z0-9]|$)`, "u");
  return pattern.test(normalizedTitle);
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

function matchWorks(candidate: ManifestCandidate, entries: WorkAliasEntry[]) {
  if (!candidate.pixivArtworkUrl || !isPixivArtworkUrl(candidate.pixivArtworkUrl)) {
    return [];
  }

  const hashtags = extractHashtags(candidate.rawText);
  const normalizedHashtags = hashtags.map((tag) => normalizeValue(tag));
  const normalizedTitle = normalizeValue(candidate.pixivTitle ?? "");
  const matches: WorkMatch[] = [];

  for (const entry of entries) {
    const { hashtagAliases, titleAliases } = buildAliasMatchers(entry);
    const matchedAliases: WorkMatch["matchedAliases"] = [];

    normalizedHashtags.forEach((tag, index) => {
      if (hashtagAliases.has(tag)) {
        matchedAliases.push({
          source: "rawText",
          alias: hashtags[index]
        });
      }
    });

    titleAliases.forEach((alias) => {
      if (titleContainsAlias(normalizedTitle, alias)) {
        matchedAliases.push({
          source: "pixivTitle",
          alias
        });
      }
    });

    if (matchedAliases.length > 0) {
      matches.push({
        canonicalName: entry.canonicalName,
        canonicalSlug: entry.canonicalSlug,
        matchedAliases
      });
    }
  }

  return matches;
}

async function loadManifest() {
  const inputPath = existsSync(enrichedManifestPath) ? enrichedManifestPath : baseManifestPath;
  if (!existsSync(inputPath)) {
    throw new Error(`Manifest not found: ${inputPath}`);
  }

  return JSON.parse(await readFile(inputPath, "utf8")) as ManifestCandidate[];
}

async function loadAliases() {
  if (!existsSync(aliasPath)) {
    throw new Error(`Alias file not found: ${aliasPath}`);
  }

  return JSON.parse(await readFile(aliasPath, "utf8")) as WorkAliasFile;
}

async function main() {
  const [manifest, aliasFile] = await Promise.all([loadManifest(), loadAliases()]);
  const pixivCandidates = manifest.filter((candidate) => isPixivArtworkUrl(candidate.pixivArtworkUrl));
  const matched: CandidateMatch[] = [];
  const ambiguous: AmbiguousCandidate[] = [];

  for (const candidate of pixivCandidates) {
    const works = matchWorks(candidate, aliasFile.entries);
    if (works.length === 1) {
      matched.push({
        folder: candidate.folder,
        anchorMessageId: candidate.anchorMessageId,
        pixivArtworkUrl: candidate.pixivArtworkUrl!,
        pixivArtworkId: candidate.pixivArtworkId ?? null,
        pixivTitle: candidate.pixivTitle ?? null,
        pixivAuthorName: candidate.pixivAuthorName ?? null,
        rawTextHashtags: extractHashtags(candidate.rawText),
        work: works[0]
      });
    } else if (works.length > 1) {
      ambiguous.push({
        folder: candidate.folder,
        anchorMessageId: candidate.anchorMessageId,
        pixivArtworkUrl: candidate.pixivArtworkUrl!,
        pixivArtworkId: candidate.pixivArtworkId ?? null,
        pixivTitle: candidate.pixivTitle ?? null,
        pixivAuthorName: candidate.pixivAuthorName ?? null,
        rawTextHashtags: extractHashtags(candidate.rawText),
        works
      });
    }
  }

  matched.sort((left, right) => Number(left.folder) - Number(right.folder));
  ambiguous.sort((left, right) => Number(left.folder) - Number(right.folder));

  const report: WorkCandidateReport = {
    generatedAt: new Date().toISOString(),
    totalPixivArtworkCandidates: pixivCandidates.length,
    matchedCount: matched.length,
    ambiguousCount: ambiguous.length,
    unmatchedCount: pixivCandidates.length - matched.length - ambiguous.length,
    matched,
    ambiguous
  };

  await mkdir(reportsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
  const latestPath = path.join(reportsDir, "pixiv-work-candidates.latest.json");
  const datedPath = path.join(reportsDir, `pixiv-work-candidates.${timestamp}.json`);

  await writeFile(latestPath, JSON.stringify(report, null, 2), "utf8");
  await writeFile(datedPath, JSON.stringify(report, null, 2), "utf8");

  console.log(`[WORK:REPORT] pixiv artwork candidates: ${report.totalPixivArtworkCandidates}`);
  console.log(`[WORK:REPORT] matched: ${report.matchedCount}`);
  console.log(`[WORK:REPORT] ambiguous: ${report.ambiguousCount}`);
  console.log(`[WORK:REPORT] unmatched: ${report.unmatchedCount}`);
  console.log(`[WORK:REPORT] latest report: ${latestPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
