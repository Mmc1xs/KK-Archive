import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { db } from "../lib/db";
import { TagType } from "@prisma/client";

type TagReviewRecord = {
  adminContentPath: string;
  work: string | null;
  character: string | null;
  style: string[];
  tgDownloadLinks: string[];
};

const OUTPUT_DIR = path.join(process.cwd(), "db image", "tag");
const TG_HOSTS = new Set(["t.me", "telegram.me"]);

function pickSingleTag(
  tags: Array<{ type: TagType; name: string }>,
  type: TagType,
): string | null {
  return tags.find((tag) => tag.type === type)?.name ?? null;
}

function pickManyTags(
  tags: Array<{ type: TagType; name: string }>,
  type: TagType,
): string[] {
  return tags.filter((tag) => tag.type === type).map((tag) => tag.name);
}

function normalizeTelegramLinks(urls: string[]): string[] {
  const links = urls.filter((rawUrl) => {
    try {
      const url = new URL(rawUrl);
      return TG_HOSTS.has(url.hostname);
    } catch {
      return false;
    }
  });

  return Array.from(new Set(links)).sort((a, b) => a.localeCompare(b));
}

async function clearExistingJsonFiles(directory: string) {
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => rm(path.join(directory, entry.name))),
  );
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await clearExistingJsonFiles(OUTPUT_DIR);

  const contents = await db.content.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      contentTags: {
        select: {
          tag: {
            select: {
              type: true,
              name: true,
            },
          },
        },
      },
      downloadLinks: {
        select: {
          url: true,
        },
      },
    },
  });

  let writtenCount = 0;

  for (const content of contents) {
    const tags = content.contentTags.map((entry) => entry.tag);
    const tgDownloadLinks = normalizeTelegramLinks(
      content.downloadLinks.map((entry) => entry.url),
    );

    const payload: TagReviewRecord = {
      adminContentPath: `/admin/contents/${content.id}`,
      work: pickSingleTag(tags, TagType.WORK),
      character: pickSingleTag(tags, TagType.CHARACTER),
      style: pickManyTags(tags, TagType.STYLE),
      tgDownloadLinks,
    };

    const outputPath = path.join(OUTPUT_DIR, `${content.id}.json`);
    await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    writtenCount += 1;
  }

  console.log(
    `[TAG] Exported ${writtenCount} content review file(s) to ${OUTPUT_DIR}`,
  );
}

main()
  .catch((error) => {
    console.error("[TAG] Failed to export tag review files.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
