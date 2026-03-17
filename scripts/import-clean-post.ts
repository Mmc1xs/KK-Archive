import "./load-env";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";
import { PublishStatus, Tag, TagType } from "@prisma/client";
import { db } from "../lib/db";

type PostJson = {
  source: {
    cleanFolder: string;
    anchorMessageId: number;
    telegramPostUrl: string;
    pixivArtworkUrl: string | null;
    pixivArtworkId: string | null;
    sourceMetaPath: string;
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

type ImportCleanPostOptions = {
  logResult?: boolean;
  authorTagCache?: Map<string, Tag>;
  typeTagCache?: Map<string, Pick<Tag, "id" | "name">>;
};

function slugify(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ensureUniqueSlug(baseSlug: string) {
  let slug = baseSlug || "content";
  let counter = 2;

  while (await db.content.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return slug;
}

async function ensureUniqueSlugForUpdate(baseSlug: string, contentId: number) {
  let slug = baseSlug || "content";
  let counter = 2;

  while (true) {
    const existing = await db.content.findUnique({ where: { slug } });
    if (!existing || existing.id === contentId) {
      return slug;
    }
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
}

async function ensureAuthorTag(name: string) {
  const existing = await db.tag.findFirst({
    where: {
      type: TagType.AUTHOR,
      name
    },
    orderBy: { id: "asc" }
  });

  if (existing) {
    return existing;
  }

  const baseSlug = `author-${slugify(name) || "unknown"}`;
  let slug = baseSlug;
  let counter = 2;
  while (await db.tag.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return db.tag.create({
    data: {
      name,
      slug,
      type: TagType.AUTHOR
    }
  });
}

function getFallbackAuthorName(name: string | null) {
  const normalized = name?.trim();
  return normalized ? normalized : "Unknown";
}

export async function importCleanPost(folder: string, options?: ImportCleanPostOptions) {
  const postPath = path.resolve(process.cwd(), "db image", "clean", folder, "post.json");
  if (!existsSync(postPath)) {
    throw new Error(`post.json not found: ${postPath}`);
  }

  const post = JSON.parse(await readFile(postPath, "utf8")) as PostJson;
  if (!post.post.typeName) {
    throw new Error("Missing typeName");
  }
  if (!post.post.coverImageUrl || !post.post.imageUrls.length) {
    throw new Error("Missing image URLs");
  }

  const existingImported = await db.content.findFirst({
    where: {
      downloadLinks: {
        some: {
          url: post.source.telegramPostUrl
        }
      }
    }
  });

  const authorName = getFallbackAuthorName(post.post.authorName);
  const cachedAuthorTag = options?.authorTagCache?.get(authorName);
  const authorTag = cachedAuthorTag ?? (await ensureAuthorTag(authorName));
  if (!cachedAuthorTag) {
    options?.authorTagCache?.set(authorName, authorTag);
  }

  const cachedTypeTag = options?.typeTagCache?.get(post.post.typeName);
  const typeTag =
    cachedTypeTag ??
    (await db.tag.findFirst({
      where: {
        type: TagType.TYPE,
        name: post.post.typeName
      },
      select: {
        id: true,
        name: true
      }
    }));

  if (!typeTag) {
    throw new Error(`Type tag not found: ${post.post.typeName}`);
  }
  if (!cachedTypeTag) {
    options?.typeTagCache?.set(post.post.typeName, typeTag);
  }

  const title = post.post.title || `Post ${folder}`;
  const slugBase = post.source.pixivArtworkId ? `pixiv-${post.source.pixivArtworkId}` : `clean-${folder}`;
  const content = existingImported
    ? await db.content.update({
        where: { id: existingImported.id },
        data: {
          title,
          slug: await ensureUniqueSlugForUpdate(slugBase, existingImported.id),
          description: post.post.description,
          coverImageUrl: post.post.coverImageUrl,
          sourceLink: post.post.sourceLink ?? post.source.pixivArtworkUrl,
          publishStatus: post.post.publishStatus,
          contentTags: {
            deleteMany: {},
            create: [{ tagId: authorTag.id }, { tagId: typeTag.id }]
          },
          images: {
            deleteMany: {},
            create: post.post.imageUrls.map((imageUrl, index) => ({
              imageUrl,
              sortOrder: index
            }))
          },
          downloadLinks: {
            deleteMany: {},
            create: post.post.downloadLinks.map((url, index) => ({
              url,
              sortOrder: index
            }))
          }
        },
        select: {
          id: true,
          slug: true,
          title: true,
          publishStatus: true
        }
      })
    : await db.content.create({
        data: {
          title,
          slug: await ensureUniqueSlug(slugBase),
          description: post.post.description,
          coverImageUrl: post.post.coverImageUrl,
          sourceLink: post.post.sourceLink ?? post.source.pixivArtworkUrl,
          publishStatus: post.post.publishStatus,
          contentTags: {
            create: [{ tagId: authorTag.id }, { tagId: typeTag.id }]
          },
          images: {
            create: post.post.imageUrls.map((imageUrl, index) => ({
              imageUrl,
              sortOrder: index
            }))
          },
          downloadLinks: {
            create: post.post.downloadLinks.map((url, index) => ({
              url,
              sortOrder: index
            }))
          }
        },
        select: {
          id: true,
          slug: true,
          title: true,
          publishStatus: true
        }
      });

  const result = {
    imported: !existingImported,
    updated: Boolean(existingImported),
    folder,
    contentId: content.id,
    slug: content.slug,
    title: content.title,
    authorName: authorTag.name,
    typeName: typeTag.name,
    imageCount: post.post.imageUrls.length,
    downloadLinks: post.post.downloadLinks,
    publishStatus: content.publishStatus
  };

  if (options?.logResult ?? true) {
    console.log(JSON.stringify(result, null, 2));
  }

  return result;
}

async function main() {
  const folder = process.argv[2];
  if (!folder) {
    throw new Error("Usage: npm exec tsx scripts/import-clean-post.ts <folder>");
  }

  await importCleanPost(folder, { logResult: true });
}

const isDirectRun = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isDirectRun) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
