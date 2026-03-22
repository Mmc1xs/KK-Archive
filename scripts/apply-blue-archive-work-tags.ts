import "./load-env";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { TagType } from "@prisma/client";
import { db } from "../lib/db";

type WorkCandidateReport = {
  canonicalName: string;
  canonicalSlug: string;
  matched: Array<{
    folder: string;
    anchorMessageId: number;
    pixivArtworkUrl: string;
    pixivArtworkId: string | null;
    pixivTitle: string | null;
    pixivAuthorName: string | null;
    rawTextHashtags: string[];
  }>;
};

type CharacterAliasEntry = {
  canonicalName: string;
  aliases: string[];
};

type CharacterAliasFile = {
  version: number;
  updatedAt: string;
  workCanonicalName: string;
  workCanonicalSlug: string;
  entries: CharacterAliasEntry[];
};

type ApplyResult = {
  slug: string;
  title: string;
  sourceLink: string | null;
  workApplied: boolean;
  characterApplied: boolean;
  characterName: string | null;
  reason: string;
};

type ApplyReport = {
  generatedAt: string;
  workCanonicalName: string;
  workCanonicalSlug: string;
  totalCandidates: number;
  processedCount: number;
  workAppliedCount: number;
  characterAppliedCount: number;
  workOnlyCount: number;
  skippedCount: number;
  ambiguousCharacterCount: number;
  unmatchedCharacterCount: number;
  applied: ApplyResult[];
  skipped: ApplyResult[];
};

const reportPath = path.resolve(process.cwd(), "scripts", "reports", "blue-archive-work-candidates.latest.json");
const characterAliasesPath = path.resolve(process.cwd(), "scripts", "pixiv-character-aliases.blue-archive.json");
const reportsDir = path.resolve(process.cwd(), "scripts", "reports");

function normalizeValue(value: string) {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/gu, " ");
}

function slugifyTagName(name: string) {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  return base || "tag";
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

async function loadReport() {
  if (!existsSync(reportPath)) {
    throw new Error(`Blue Archive report not found: ${reportPath}`);
  }

  return JSON.parse(await readFile(reportPath, "utf8")) as WorkCandidateReport;
}

async function loadCharacterAliases() {
  if (!existsSync(characterAliasesPath)) {
    throw new Error(`Character alias file not found: ${characterAliasesPath}`);
  }

  return JSON.parse(await readFile(characterAliasesPath, "utf8")) as CharacterAliasFile;
}

async function ensureBlueArchiveWorkTag(canonicalName: string, canonicalSlug: string) {
  const existing = await db.tag.findFirst({
    where: {
      type: TagType.WORK,
      OR: [{ slug: canonicalSlug }, { name: canonicalName }]
    }
  });

  if (existing) {
    return existing;
  }

  return db.tag.create({
    data: {
      name: canonicalName,
      slug: canonicalSlug,
      type: TagType.WORK
    }
  });
}

async function ensureCharacterTag(canonicalName: string, workTagId: number) {
  const existing = await db.tag.findFirst({
    where: {
      type: TagType.CHARACTER,
      workTagId,
      name: canonicalName
    }
  });

  if (existing) {
    return existing;
  }

  const baseSlug = `character-${workTagId}-${slugifyTagName(canonicalName)}`;
  let slug = baseSlug;
  let counter = 2;

  while (await db.tag.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return db.tag.create({
    data: {
      name: canonicalName,
      slug,
      type: TagType.CHARACTER,
      workTagId
    }
  });
}

function inferCharacter(
  title: string,
  hashtags: string[],
  characterAliases: CharacterAliasEntry[]
): { entry: CharacterAliasEntry | null; reason: "matched" | "ambiguous" | "unmatched" } {
  const normalizedTitle = normalizeValue(title);
  const normalizedHashtags = new Set(hashtags.map((tag) => normalizeValue(tag)));
  const matches: CharacterAliasEntry[] = [];

  for (const entry of characterAliases) {
    const matched = entry.aliases.some((aliasValue) => {
      const alias = normalizeValue(aliasValue);
      return normalizedHashtags.has(alias) || titleContainsAlias(normalizedTitle, alias);
    });

    if (matched) {
      matches.push(entry);
    }
  }

  if (matches.length === 0) {
    return { entry: null, reason: "unmatched" };
  }

  if (matches.length > 1) {
    const exactNameMatches = matches.filter((entry) =>
      entry.aliases.some((aliasValue) => normalizeValue(aliasValue) === normalizedTitle)
    );

    if (exactNameMatches.length === 1) {
      return { entry: exactNameMatches[0], reason: "matched" };
    }

    return { entry: null, reason: "ambiguous" };
  }

  return { entry: matches[0], reason: "matched" };
}

async function main() {
  const [report, characterAliasFile] = await Promise.all([loadReport(), loadCharacterAliases()]);
  const workTag = await ensureBlueArchiveWorkTag(report.canonicalName, report.canonicalSlug);
  const candidatesByUrl = new Map(report.matched.map((item) => [item.pixivArtworkUrl, item]));
  const contents = await db.content.findMany({
    where: {
      sourceLink: {
        in: [...candidatesByUrl.keys()]
      }
    },
    select: {
      id: true,
      slug: true,
      title: true,
      sourceLink: true,
      contentTags: {
        select: {
          tagId: true,
          tag: {
            select: {
              id: true,
              type: true,
              name: true,
              slug: true
            }
          }
        }
      }
    }
  });

  const applied: ApplyResult[] = [];
  const skipped: ApplyResult[] = [];

  for (const content of contents) {
    const candidate = content.sourceLink ? candidatesByUrl.get(content.sourceLink) : null;
    if (!candidate) {
      skipped.push({
        slug: content.slug,
        title: content.title,
        sourceLink: content.sourceLink,
        workApplied: false,
        characterApplied: false,
        characterName: null,
        reason: "candidate-not-found"
      });
      continue;
    }

    const existingWork = content.contentTags.find((item) => item.tag.type === TagType.WORK)?.tag ?? null;
    const existingCharacter = content.contentTags.find((item) => item.tag.type === TagType.CHARACTER)?.tag ?? null;

    if (existingWork && existingWork.slug !== workTag.slug) {
      skipped.push({
        slug: content.slug,
        title: content.title,
        sourceLink: content.sourceLink,
        workApplied: false,
        characterApplied: false,
        characterName: existingCharacter?.name ?? null,
        reason: `conflicting-work:${existingWork.name}`
      });
      continue;
    }

    const characterInference = inferCharacter(
      candidate.pixivTitle ?? content.title,
      candidate.rawTextHashtags,
      characterAliasFile.entries
    );

    let characterTagId: number | null = null;
    let characterName: string | null = null;
    if (characterInference.entry) {
      const characterTag = await ensureCharacterTag(characterInference.entry.canonicalName, workTag.id);
      characterTagId = characterTag.id;
      characterName = characterTag.name;
    }

    const preservedTagIds = content.contentTags
      .filter((item) => item.tag.type !== TagType.WORK && item.tag.type !== TagType.CHARACTER)
      .map((item) => item.tagId);
    const nextTagIds = [
      ...preservedTagIds,
      workTag.id,
      ...(characterTagId ? [characterTagId] : [])
    ];
    const currentWorkTagId = existingWork?.id ?? null;
    const currentCharacterTagId = existingCharacter?.id ?? null;
    const needsUpdate =
      currentWorkTagId !== workTag.id ||
      currentCharacterTagId !== characterTagId ||
      content.contentTags.length !== nextTagIds.length;

    if (!needsUpdate) {
      skipped.push({
        slug: content.slug,
        title: content.title,
        sourceLink: content.sourceLink,
        workApplied: false,
        characterApplied: false,
        characterName,
        reason: "already-up-to-date"
      });
      continue;
    }

    await db.content.update({
      where: { id: content.id },
      data: {
        contentTags: {
          deleteMany: {},
          create: nextTagIds.map((tagId) => ({ tagId }))
        }
      }
    });

    applied.push({
      slug: content.slug,
      title: content.title,
      sourceLink: content.sourceLink,
      workApplied: true,
      characterApplied: Boolean(characterTagId),
      characterName,
      reason: characterInference.reason
    });
  }

  const workOnlyCount = applied.filter((item) => item.workApplied && !item.characterApplied).length;
  const reportOutput: ApplyReport = {
    generatedAt: new Date().toISOString(),
    workCanonicalName: report.canonicalName,
    workCanonicalSlug: report.canonicalSlug,
    totalCandidates: report.matched.length,
    processedCount: contents.length,
    workAppliedCount: applied.length,
    characterAppliedCount: applied.filter((item) => item.characterApplied).length,
    workOnlyCount,
    skippedCount: skipped.length,
    ambiguousCharacterCount: applied.filter((item) => item.reason === "ambiguous").length,
    unmatchedCharacterCount: applied.filter((item) => item.reason === "unmatched").length,
    applied,
    skipped
  };

  await mkdir(reportsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
  const latestPath = path.join(reportsDir, "blue-archive-work-apply.latest.json");
  const datedPath = path.join(reportsDir, `blue-archive-work-apply.${timestamp}.json`);
  await writeFile(latestPath, JSON.stringify(reportOutput, null, 2), "utf8");
  await writeFile(datedPath, JSON.stringify(reportOutput, null, 2), "utf8");

  console.log(`[WORK:BLUE-ARCHIVE:APPLY] processed: ${reportOutput.processedCount}/${reportOutput.totalCandidates}`);
  console.log(`[WORK:BLUE-ARCHIVE:APPLY] work applied: ${reportOutput.workAppliedCount}`);
  console.log(`[WORK:BLUE-ARCHIVE:APPLY] character applied: ${reportOutput.characterAppliedCount}`);
  console.log(`[WORK:BLUE-ARCHIVE:APPLY] work only: ${reportOutput.workOnlyCount}`);
  console.log(`[WORK:BLUE-ARCHIVE:APPLY] ambiguous character: ${reportOutput.ambiguousCharacterCount}`);
  console.log(`[WORK:BLUE-ARCHIVE:APPLY] unmatched character: ${reportOutput.unmatchedCharacterCount}`);
  console.log(`[WORK:BLUE-ARCHIVE:APPLY] skipped: ${reportOutput.skippedCount}`);
  console.log(`[WORK:BLUE-ARCHIVE:APPLY] latest report: ${latestPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
