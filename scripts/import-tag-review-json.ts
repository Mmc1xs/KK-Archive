import "./load-env";

import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { TagType, type PrismaClient } from "@prisma/client";

type DbModule = {
  db: PrismaClient;
};

type TagReviewRecord = {
  adminContentPath: string;
  work: string | null;
  character: string | null;
  style: string[];
  tgDownloadLinks: string[];
};

type ExistingTag = {
  id: number;
  name: string;
  slug: string;
  type: TagType;
  workTagId: number | null;
};

type ExistingContent = {
  id: number;
  slug: string;
  title: string;
  publishStatus: string;
  contentTags: Array<{
    tagId: number;
    tag: ExistingTag;
  }>;
};

type ImportSummary = {
  scannedFiles: number;
  matchedContents: number;
  updatedContents: number;
  unchangedContents: number;
  missingContents: number;
  createdWorkTags: number;
  createdCharacterTags: number;
  createdStyleTags: number;
  skippedCharacterWithoutWork: number;
  clearedMismatchedCharacters: number;
};

let db: PrismaClient;
const TAG_REVIEW_DIR = path.resolve(process.cwd(), "db image", "tag");

function slugifyTagName(name: string) {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || "tag";
}

function parseIdsArg() {
  const idsArg = process.argv.find((arg) => arg.startsWith("--ids="));
  if (!idsArg) {
    return null;
  }

  const ids = idsArg
    .slice("--ids=".length)
    .split(/[\s,]+/)
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);

  return ids.length ? [...new Set(ids)] : null;
}

function parseLimitArg() {
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  if (!limitArg) {
    return null;
  }

  const limit = Number(limitArg.slice("--limit=".length));
  return Number.isInteger(limit) && limit > 0 ? limit : null;
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function normalizeName(value: string) {
  return value.trim().normalize("NFKC");
}

function uniqueNumbers(values: number[]) {
  return [...new Set(values)];
}

function sameNumberSet(a: number[], b: number[]) {
  if (a.length !== b.length) {
    return false;
  }

  const sortedA = [...a].sort((left, right) => left - right);
  const sortedB = [...b].sort((left, right) => left - right);
  return sortedA.every((value, index) => value === sortedB[index]);
}

async function loadReviewRecords() {
  const files = (await readdir(TAG_REVIEW_DIR))
    .filter((name) => name.endsWith(".json"))
    .sort((left, right) => Number(left.replace(".json", "")) - Number(right.replace(".json", "")));

  const reviews = await Promise.all(
    files.map(async (file) => {
      const id = Number(file.replace(".json", ""));
      const raw = await readFile(path.join(TAG_REVIEW_DIR, file), "utf8");
      return {
        id,
        file,
        record: JSON.parse(raw) as TagReviewRecord,
      };
    }),
  );

  return reviews;
}

async function loadExistingContents(ids: number[]) {
  const contents = await db.content.findMany({
    where: {
      id: {
        in: ids,
      },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      publishStatus: true,
      contentTags: {
        select: {
          tagId: true,
          tag: {
            select: {
              id: true,
              name: true,
              slug: true,
              type: true,
              workTagId: true,
            },
          },
        },
      },
    },
  });

  return new Map(contents.map((content) => [content.id, content satisfies ExistingContent]));
}

async function main() {
  const importedDbModule = (await import("../lib/db.ts")) as DbModule & { default?: DbModule };
  db = (importedDbModule.default ?? importedDbModule).db;

  const dryRun = hasFlag("--dry-run");
  const verbose = hasFlag("--verbose");
  const selectedIds = parseIdsArg();
  const limit = parseLimitArg();

  const summary: ImportSummary = {
    scannedFiles: 0,
    matchedContents: 0,
    updatedContents: 0,
    unchangedContents: 0,
    missingContents: 0,
    createdWorkTags: 0,
    createdCharacterTags: 0,
    createdStyleTags: 0,
    skippedCharacterWithoutWork: 0,
    clearedMismatchedCharacters: 0,
  };

  const tagCache = await db.tag.findMany({
    where: {
      type: {
        in: [TagType.WORK, TagType.CHARACTER, TagType.STYLE],
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      workTagId: true,
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  const usedSlugs = new Set(tagCache.map((tag) => tag.slug));
  const workByName = new Map<string, ExistingTag>();
  const styleByName = new Map<string, ExistingTag>();
  const characterByKey = new Map<string, ExistingTag>();

  for (const tag of tagCache) {
    if (tag.type === TagType.WORK) {
      workByName.set(normalizeName(tag.name), tag);
    } else if (tag.type === TagType.STYLE) {
      styleByName.set(normalizeName(tag.name), tag);
    } else if (tag.type === TagType.CHARACTER) {
      characterByKey.set(`${tag.workTagId ?? 0}:${normalizeName(tag.name)}`, tag);
    }
  }

  async function createTag(name: string, type: TagType, workTagId?: number) {
    const basePrefix = type === TagType.CHARACTER && typeof workTagId === "number"
      ? `character-${workTagId}-${slugifyTagName(name)}`
      : `${type.toLowerCase()}-${slugifyTagName(name)}`;

    let slug = basePrefix;
    let counter = 2;
    while (usedSlugs.has(slug)) {
      slug = `${basePrefix}-${counter}`;
      counter += 1;
    }

    const created = await db.tag.create({
      data: {
        name,
        slug,
        type,
        ...(type === TagType.CHARACTER && typeof workTagId === "number" ? { workTagId } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        workTagId: true,
      },
    });

    usedSlugs.add(created.slug);
    return created;
  }

  async function ensureWorkTag(name: string) {
    const normalized = normalizeName(name);
    const cached = workByName.get(normalized);
    if (cached) {
      return cached;
    }

    const created = await createTag(name, TagType.WORK);
    workByName.set(normalized, created);
    summary.createdWorkTags += 1;
    return created;
  }

  async function ensureStyleTag(name: string) {
    const normalized = normalizeName(name);
    const cached = styleByName.get(normalized);
    if (cached) {
      return cached;
    }

    const created = await createTag(name, TagType.STYLE);
    styleByName.set(normalized, created);
    summary.createdStyleTags += 1;
    return created;
  }

  async function ensureCharacterTag(name: string, workTagId: number) {
    const normalized = normalizeName(name);
    const key = `${workTagId}:${normalized}`;
    const cached = characterByKey.get(key);
    if (cached) {
      return cached;
    }

    const created = await createTag(name, TagType.CHARACTER, workTagId);
    characterByKey.set(key, created);
    summary.createdCharacterTags += 1;
    return created;
  }

  let reviews = await loadReviewRecords();
  if (selectedIds) {
    const allowed = new Set(selectedIds);
    reviews = reviews.filter((review) => allowed.has(review.id));
  }
  if (limit) {
    reviews = reviews.slice(0, limit);
  }

  summary.scannedFiles = reviews.length;
  const contentsById = await loadExistingContents(reviews.map((review) => review.id));

  for (const review of reviews) {
    const content = contentsById.get(review.id);
    if (!content) {
      summary.missingContents += 1;
      continue;
    }

    summary.matchedContents += 1;

    const currentWorkTags = content.contentTags.filter((entry) => entry.tag.type === TagType.WORK);
    const currentCharacterTags = content.contentTags.filter((entry) => entry.tag.type === TagType.CHARACTER);
    const currentStyleTags = content.contentTags.filter((entry) => entry.tag.type === TagType.STYLE);
    const preservedTagIds = content.contentTags
      .filter((entry) => entry.tag.type !== TagType.WORK && entry.tag.type !== TagType.CHARACTER && entry.tag.type !== TagType.STYLE)
      .map((entry) => entry.tagId);

    let nextWorkTagIds = currentWorkTags.map((entry) => entry.tagId);
    let nextCharacterTagIds = currentCharacterTags.map((entry) => entry.tagId);
    let nextStyleTagIds = currentStyleTags.map((entry) => entry.tagId);
    let desiredWorkTag: ExistingTag | null = null;

    if (review.record.work?.trim()) {
      desiredWorkTag = await ensureWorkTag(review.record.work.trim());
      nextWorkTagIds = [desiredWorkTag.id];
    }

    if (review.record.style.length > 0) {
      const styleTags = [];
      for (const styleName of review.record.style.map((value) => value.trim()).filter(Boolean)) {
        styleTags.push(await ensureStyleTag(styleName));
      }
      nextStyleTagIds = uniqueNumbers(styleTags.map((tag) => tag.id));
    }

    if (review.record.character?.trim()) {
      const effectiveWorkTag =
        desiredWorkTag ??
        (currentWorkTags.length === 1 ? currentWorkTags[0].tag : null);

      if (effectiveWorkTag) {
        const desiredCharacter = await ensureCharacterTag(review.record.character.trim(), effectiveWorkTag.id);
        nextCharacterTagIds = [desiredCharacter.id];
      } else {
        summary.skippedCharacterWithoutWork += 1;
      }
    } else if (
      desiredWorkTag &&
      currentCharacterTags.some((entry) => entry.tag.workTagId !== desiredWorkTag.id)
    ) {
      nextCharacterTagIds = [];
      summary.clearedMismatchedCharacters += 1;
    }

    const nextTagIds = uniqueNumbers([
      ...preservedTagIds,
      ...nextWorkTagIds,
      ...nextCharacterTagIds,
      ...nextStyleTagIds,
    ]);
    const currentTagIds = uniqueNumbers(content.contentTags.map((entry) => entry.tagId));

    if (sameNumberSet(nextTagIds, currentTagIds)) {
      summary.unchangedContents += 1;
      continue;
    }

    if (!dryRun) {
      await db.$transaction(async (tx) => {
        await tx.contentTag.deleteMany({
          where: {
            contentId: content.id,
          },
        });
        await tx.contentTag.createMany({
          data: nextTagIds.map((tagId) => ({
            contentId: content.id,
            tagId,
          })),
        });
      });
    }

    summary.updatedContents += 1;

    if (verbose) {
      const nextWorkNames = desiredWorkTag ? [desiredWorkTag.name] : currentWorkTags.map((entry) => entry.tag.name);
      const nextCharacterNames = review.record.character?.trim()
        ? [review.record.character.trim()]
        : nextCharacterTagIds.length
          ? currentCharacterTags.map((entry) => entry.tag.name)
          : [];
      console.log(
        `[TAG IMPORT] ${dryRun ? "DRY RUN " : ""}updated content #${content.id} (${content.slug}) work=${nextWorkNames.join(", ") || "-"} character=${nextCharacterNames.join(", ") || "-"} styles=${nextStyleTagIds.length}`,
      );
    }
  }

  console.log(JSON.stringify({ dryRun, summary }, null, 2));
}

main()
  .catch((error) => {
    console.error("[TAG IMPORT] Failed to import review tags.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (db) {
      await db.$disconnect();
    }
  });
