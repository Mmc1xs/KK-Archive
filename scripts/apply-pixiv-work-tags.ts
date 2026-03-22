import "./load-env";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { TagType } from "@prisma/client";
import { db } from "../lib/db";

type WorkCandidateReport = {
  generatedAt: string;
  matched: Array<{
    folder: string;
    anchorMessageId: number;
    pixivArtworkUrl: string;
    pixivArtworkId: string | null;
    pixivTitle: string | null;
    pixivAuthorName: string | null;
    rawTextHashtags: string[];
    work: {
      canonicalName: string;
      canonicalSlug: string;
      matchedAliases: Array<{
        source: "rawText" | "pixivTitle";
        alias: string;
      }>;
    };
  }>;
  ambiguous: Array<{
    folder: string;
    pixivArtworkUrl: string;
    works: Array<{
      canonicalName: string;
      canonicalSlug: string;
    }>;
  }>;
};

type ApplyResult = {
  slug: string;
  title: string;
  sourceLink: string | null;
  canonicalName: string;
  canonicalSlug: string;
  reason: string;
};

type ApplyReport = {
  generatedAt: string;
  totalMatchedCandidates: number;
  processedCount: number;
  appliedCount: number;
  skippedCount: number;
  conflictingCount: number;
  alreadyUpToDateCount: number;
  ambiguousCount: number;
  applied: ApplyResult[];
  skipped: ApplyResult[];
};

const reportPath = path.resolve(process.cwd(), "scripts", "reports", "pixiv-work-candidates.latest.json");
const reportsDir = path.resolve(process.cwd(), "scripts", "reports");

async function loadReport() {
  if (!existsSync(reportPath)) {
    throw new Error(`Work report not found: ${reportPath}`);
  }

  return JSON.parse(await readFile(reportPath, "utf8")) as WorkCandidateReport;
}

async function ensureWorkTag(canonicalName: string, canonicalSlug: string) {
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

async function main() {
  const report = await loadReport();
  const workTagMap = new Map<string, { id: number; name: string; slug: string }>();

  for (const item of report.matched) {
    if (!workTagMap.has(item.work.canonicalSlug)) {
      const workTag = await ensureWorkTag(item.work.canonicalName, item.work.canonicalSlug);
      workTagMap.set(item.work.canonicalSlug, {
        id: workTag.id,
        name: workTag.name,
        slug: workTag.slug
      });
    }
  }

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
      continue;
    }

    const nextWorkTag = workTagMap.get(candidate.work.canonicalSlug);
    if (!nextWorkTag) {
      skipped.push({
        slug: content.slug,
        title: content.title,
        sourceLink: content.sourceLink,
        canonicalName: candidate.work.canonicalName,
        canonicalSlug: candidate.work.canonicalSlug,
        reason: "work-tag-not-found"
      });
      continue;
    }

    const existingWork = content.contentTags.find((item) => item.tag.type === TagType.WORK)?.tag ?? null;
    if (existingWork && existingWork.slug !== nextWorkTag.slug) {
      skipped.push({
        slug: content.slug,
        title: content.title,
        sourceLink: content.sourceLink,
        canonicalName: candidate.work.canonicalName,
        canonicalSlug: candidate.work.canonicalSlug,
        reason: `conflicting-work:${existingWork.name}`
      });
      continue;
    }

    const preservedTagIds = content.contentTags
      .filter((item) => item.tag.type !== TagType.WORK)
      .map((item) => item.tagId);
    const nextTagIds = [...preservedTagIds, nextWorkTag.id];
    const needsUpdate = existingWork?.id !== nextWorkTag.id || content.contentTags.length !== nextTagIds.length;

    if (!needsUpdate) {
      skipped.push({
        slug: content.slug,
        title: content.title,
        sourceLink: content.sourceLink,
        canonicalName: candidate.work.canonicalName,
        canonicalSlug: candidate.work.canonicalSlug,
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
      canonicalName: candidate.work.canonicalName,
      canonicalSlug: candidate.work.canonicalSlug,
      reason: "applied"
    });
  }

  const reportOutput: ApplyReport = {
    generatedAt: new Date().toISOString(),
    totalMatchedCandidates: report.matched.length,
    processedCount: contents.length,
    appliedCount: applied.length,
    skippedCount: skipped.length,
    conflictingCount: skipped.filter((item) => item.reason.startsWith("conflicting-work:")).length,
    alreadyUpToDateCount: skipped.filter((item) => item.reason === "already-up-to-date").length,
    ambiguousCount: report.ambiguous.length,
    applied,
    skipped
  };

  await mkdir(reportsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
  const latestPath = path.join(reportsDir, "pixiv-work-apply.latest.json");
  const datedPath = path.join(reportsDir, `pixiv-work-apply.${timestamp}.json`);

  await writeFile(latestPath, JSON.stringify(reportOutput, null, 2), "utf8");
  await writeFile(datedPath, JSON.stringify(reportOutput, null, 2), "utf8");

  console.log(`[WORK:APPLY] matched candidates: ${reportOutput.totalMatchedCandidates}`);
  console.log(`[WORK:APPLY] processed: ${reportOutput.processedCount}`);
  console.log(`[WORK:APPLY] applied: ${reportOutput.appliedCount}`);
  console.log(`[WORK:APPLY] skipped: ${reportOutput.skippedCount}`);
  console.log(`[WORK:APPLY] conflicting: ${reportOutput.conflictingCount}`);
  console.log(`[WORK:APPLY] already up to date: ${reportOutput.alreadyUpToDateCount}`);
  console.log(`[WORK:APPLY] ambiguous work candidates: ${reportOutput.ambiguousCount}`);
  console.log(`[WORK:APPLY] latest report: ${latestPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
