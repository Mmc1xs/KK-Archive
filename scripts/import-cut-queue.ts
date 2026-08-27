import "./load-env";
import path from "path";
import { existsSync } from "fs";
import { promises as fs } from "fs";
import { pathToFileURL } from "url";
import { PublishStatus, ReviewStatus, TagType, UserRole, type Tag } from "@prisma/client";
import { db } from "../lib/db";
import { isApexDriveUrl } from "../lib/download-providers";
import { uploadR2Object, buildR2PublicUrl } from "../lib/storage/r2";
import { buildContentFileDownloadPath } from "../lib/downloads/content-file-token";

type QueueFile = {
  version: 1;
  defaults?: {
    typeName?: string;
    publishStatus?: PublishStatus;
    reviewStatus?: ReviewStatus;
  };
  items: QueueItem[];
};

type QueueItem = {
  folder: string;
  imageFolder?: string;
  imageFileNames?: string[];
  downloadFolder?: string;
  downloadFileNames?: string[];
  downloadFileLabels?: Record<string, string>;
  sourceLink?: string | null;
  allowDuplicateSource?: boolean;
  skipPixivMetadataFetch?: boolean;
  tgLink?: string;
  apexDriveLink?: string;
  apexDriveLinks?: string[];
  apexDriveUrl?: string;
  apexDriveUrls?: string[];
  titleOverride?: string;
  authorOverride?: string;
  characterName?: string;
  workName?: string;
  typeName?: string;
  copyTagsFromSlug?: string;
  styleNames?: string[];
  usageNames?: string[];
  description?: string;
};

type RawQueueItem = QueueItem & {
  Title?: string | null;
};

type PixivIllustResponse = {
  error: boolean;
  message: string;
  body: {
    illustTitle: string;
    userName: string;
    tags?: {
      tags?: Array<{ tag: string }>;
    };
  };
};

type WorkAliasesFile = {
  entries: Array<{
    canonicalName: string;
    aliases: string[];
  }>;
};

const CUT_ROOT = path.resolve(process.cwd(), "db image", "cut");
const DEFAULT_QUEUE = path.join(CUT_ROOT, "queue.json");
const LARGE_DOWNLOAD_LIMIT_BYTES = 200 * 1024 * 1024;
const WORK_ALIAS_PATH = path.resolve(process.cwd(), "scripts", "pixiv-work-aliases.json");
const PROJECT_ROOT = path.resolve(process.cwd());

function resolveProjectPath(relativePath: string) {
  const resolved = path.resolve(PROJECT_ROOT, relativePath);
  const relative = path.relative(PROJECT_ROOT, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Asset path must stay inside the project root: ${relativePath}`);
  }
  return resolved;
}

function slugify(input: string) {
  const base = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "tag";
}

function sanitizeFileName(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  const base = path
    .basename(fileName, ext)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${base || "file"}${ext}`;
}

function guessMime(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".zip":
      return "application/zip";
    case ".7z":
      return "application/x-7z-compressed";
    case ".rar":
      return "application/vnd.rar";
    default:
      return "application/octet-stream";
  }
}

function parsePixivArtworkId(sourceLink: string) {
  const matched = sourceLink.match(/artworks\/(\d+)/i);
  return matched?.[1] ?? null;
}

function repairQueueJson(raw: string) {
  return raw.replace(/(:\s*|\[\s*|,\s*)NULL(\s*[,}\]])/g, "$1null$2");
}

function normalizeQueueItem(item: RawQueueItem): QueueItem {
  const titleOverride = item.titleOverride?.trim() || item.Title?.trim() || undefined;
  const sourceLink = typeof item.sourceLink === "string" ? item.sourceLink.trim() || null : null;
  const apexDriveLinks = [
    ...(Array.isArray(item.apexDriveLinks) ? item.apexDriveLinks : []),
    ...(Array.isArray(item.apexDriveUrls) ? item.apexDriveUrls : [])
  ]
    .map((url) => url.trim())
    .filter(Boolean);
  const apexDriveLink = item.apexDriveLink?.trim() || item.apexDriveUrl?.trim() || undefined;

  return {
    ...item,
    sourceLink,
    titleOverride,
    apexDriveLink,
    apexDriveLinks
  };
}

function normalizeKey(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g, "")
    .trim();
}

function getApexDriveLinks(item: QueueItem) {
  const links = [
    item.apexDriveLink?.trim(),
    item.apexDriveUrl?.trim(),
    ...(item.apexDriveLinks ?? []).map((url) => url.trim()),
    ...(item.apexDriveUrls ?? []).map((url) => url.trim())
  ].filter((url): url is string => Boolean(url));
  const uniqueLinks = [...new Set(links)];
  const invalidLinks = uniqueLinks.filter((url) => !isApexDriveUrl(url));
  if (invalidLinks.length) {
    throw new Error(`Invalid ApexDrive link(s): ${invalidLinks.join(", ")}`);
  }
  return uniqueLinks;
}

async function fetchPixivIllust(artworkId: string) {
  const cookie = process.env.PIXIV_COOKIE?.trim();
  const response = await fetch(`https://www.pixiv.net/ajax/illust/${artworkId}`, {
    headers: {
      Referer: "https://www.pixiv.net/",
      "User-Agent": "Mozilla/5.0",
      ...(cookie ? { Cookie: cookie } : {})
    }
  });

  if (!response.ok) {
    throw new Error(`Pixiv request failed: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as PixivIllustResponse;
  if (json.error || !json.body) {
    throw new Error(`Pixiv response error: ${json.message || "unknown"}`);
  }

  return {
    title: json.body.illustTitle?.trim() || null,
    author: json.body.userName?.trim() || null,
    tags: (json.body.tags?.tags ?? []).map((x) => x.tag).filter(Boolean)
  };
}

async function ensureUniqueContentSlug(baseSlug: string) {
  let slug = baseSlug || "content";
  let counter = 2;
  while (await db.content.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
  return slug;
}

async function ensureUniqueTagSlug(baseSlug: string) {
  let slug = baseSlug || "tag";
  let counter = 2;
  while (await db.tag.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
  return slug;
}

async function ensureTagByTypeAndName(type: TagType, name: string, workTagId?: number | null) {
  const found = await db.tag.findFirst({
    where: {
      type,
      name,
      ...(type === TagType.CHARACTER ? { workTagId: workTagId ?? null } : {})
    }
  });

  if (found) {
    return found;
  }

  const baseSlug =
    type === TagType.AUTHOR
      ? `author-${slugify(name)}`
      : type === TagType.CHARACTER
        ? `character-${workTagId ?? "none"}-${slugify(name)}`
        : `${type.toLowerCase()}-${slugify(name)}`;

  const slug = await ensureUniqueTagSlug(baseSlug);
  return db.tag.create({
    data: {
      name,
      slug,
      type,
      ...(type === TagType.CHARACTER ? { workTagId: workTagId ?? null } : {})
    }
  });
}

async function loadWorkAliasMap() {
  if (!existsSync(WORK_ALIAS_PATH)) {
    return new Map<string, string>();
  }

  const raw = await fs.readFile(WORK_ALIAS_PATH, "utf8");
  const parsed = JSON.parse(raw) as WorkAliasesFile;
  const map = new Map<string, string>();

  for (const entry of parsed.entries ?? []) {
    const canon = entry.canonicalName?.trim();
    if (!canon) continue;

    map.set(normalizeKey(canon), canon);
    for (const alias of entry.aliases ?? []) {
      if (!alias) continue;
      map.set(normalizeKey(alias), canon);
    }
  }

  return map;
}

async function inferWorkTag(item: QueueItem, pixivTags: string[], aliasMap: Map<string, string>) {
  if (item.workName) {
    const workName = item.workName.trim();
    const direct = await db.tag.findFirst({ where: { type: TagType.WORK, name: workName } });
    if (!direct) {
      return ensureTagByTypeAndName(TagType.WORK, workName);
    }
    return direct;
  }

  for (const rawTag of pixivTags) {
    const canonical = aliasMap.get(normalizeKey(rawTag));
    if (!canonical) continue;
    const work = await db.tag.findFirst({ where: { type: TagType.WORK, name: canonical } });
    if (work) {
      return work;
    }
    return ensureTagByTypeAndName(TagType.WORK, canonical);
  }

  return null;
}

async function resolveBaseTags(item: QueueItem, inferredWorkTag: Tag | null) {
  if (!item.copyTagsFromSlug) {
    return {
      workTag: inferredWorkTag,
      extraStyleTags: [] as Tag[],
      extraUsageTags: [] as Tag[],
      baseTypeTag: null as Tag | null,
      baseCharacterTag: null as Tag | null
    };
  }

  const ref = await db.content.findUnique({
    where: { slug: item.copyTagsFromSlug },
    select: {
      contentTags: {
        select: { tag: true }
      }
    }
  });

  if (!ref) {
    throw new Error(`copyTagsFromSlug not found: ${item.copyTagsFromSlug}`);
  }

  const tags = ref.contentTags.map((x) => x.tag);
  const workTag = tags.find((t) => t.type === TagType.WORK) ?? inferredWorkTag;
  const baseTypeTag = tags.find((t) => t.type === TagType.TYPE) ?? null;
  const baseCharacterTag = tags.find((t) => t.type === TagType.CHARACTER) ?? null;
  const extraStyleTags = tags.filter((t) => t.type === TagType.STYLE);
  const extraUsageTags = tags.filter((t) => t.type === TagType.USAGE);

  return { workTag, extraStyleTags, extraUsageTags, baseTypeTag, baseCharacterTag };
}

async function importOne(item: QueueItem, defaults: QueueFile["defaults"], aliasMap: Map<string, string>) {
  const sourceLink = item.sourceLink?.trim() || "";
  const artworkId = parsePixivArtworkId(sourceLink);

  if (artworkId && !item.allowDuplicateSource) {
    const existingBySource = await db.content.findFirst({
      where: { sourceLink },
      select: { id: true, slug: true, title: true }
    });

    if (existingBySource) {
      return { skipped: true, reason: "source_exists", existingBySource };
    }
  }

  const folderPath = item.imageFolder?.trim()
    ? resolveProjectPath(item.imageFolder.trim())
    : path.join(CUT_ROOT, item.folder);
  const downloadFolderPath = item.downloadFolder?.trim()
    ? resolveProjectPath(item.downloadFolder.trim())
    : path.join(folderPath, "d");

  const folderItems = await fs.readdir(folderPath, { withFileTypes: true });
  const availableImageFiles = folderItems
    .filter((x) => x.isFile())
    .map((x) => x.name)
    .filter((name) => /\.(jpg|jpeg|png|webp)$/i.test(name))
    .sort((a, b) => a.localeCompare(b, "en"));

  const requestedImageFiles = item.imageFileNames
    ?.map((name) => name.trim())
    .filter(Boolean);
  const imageFiles = requestedImageFiles?.length
    ? requestedImageFiles.map((name) => {
        if (!availableImageFiles.includes(name)) {
          throw new Error(`Requested image file not found in ${folderPath}: ${name}`);
        }
        return name;
      })
    : availableImageFiles;

  if (imageFiles.length === 0) {
    throw new Error(`No images found in ${folderPath}`);
  }

  const availableDownloadFiles = existsSync(downloadFolderPath)
    ? (await fs.readdir(downloadFolderPath, { withFileTypes: true }))
        .filter((x) => x.isFile())
        .map((x) => x.name)
        .sort((a, b) => a.localeCompare(b, "en"))
    : [];

  const requestedDownloadFiles = item.downloadFileNames?.map((name) => name.trim()).filter(Boolean);
  const downloadFiles = requestedDownloadFiles
    ? requestedDownloadFiles.map((name) => {
        if (!availableDownloadFiles.includes(name)) {
          throw new Error(`Requested download file not found in ${downloadFolderPath}: ${name}`);
        }
        return name;
      })
    : availableDownloadFiles;

  const pixiv = artworkId && !item.skipPixivMetadataFetch
    ? await fetchPixivIllust(artworkId)
    : { title: null, author: null, tags: [] as string[] };

  const title = item.titleOverride?.trim() || pixiv.title || item.characterName?.trim() || item.folder.trim();
  const authorName = item.authorOverride?.trim() || pixiv.author || "Unknown";
  const characterName = item.characterName?.trim() || item.folder.trim();

  const inferredWorkTag = await inferWorkTag(item, pixiv.tags, aliasMap);
  const baseTags = await resolveBaseTags(item, inferredWorkTag);
  const workTag = baseTags.workTag;

  if (!workTag) {
    throw new Error(
      `Unable to infer work tag for folder '${item.folder}'. Add workName or copyTagsFromSlug in queue.json.`
    );
  }

  const typeName = item.typeName?.trim() || defaults?.typeName?.trim() || baseTags.baseTypeTag?.name || "KK";
  const typeTag =
    (await db.tag.findFirst({ where: { type: TagType.TYPE, name: typeName } })) ??
    (typeName === "KK" ? await ensureTagByTypeAndName(TagType.TYPE, typeName) : null);
  if (!typeTag) {
    throw new Error(`Type tag not found: ${typeName}`);
  }

  const authorTag = await ensureTagByTypeAndName(TagType.AUTHOR, authorName);
  const characterTag = await ensureTagByTypeAndName(TagType.CHARACTER, characterName, workTag.id);

  const explicitStyleNames = item.styleNames?.map((name) => name.trim()).filter(Boolean) ?? [];
  const styleTags = explicitStyleNames.length
    ? await Promise.all(explicitStyleNames.map((name) => ensureTagByTypeAndName(TagType.STYLE, name)))
    : baseTags.extraStyleTags;

  if (styleTags.length === 0) {
    throw new Error(
      `Style is required for folder '${item.folder}'. Add at least one styleNames value or use copyTagsFromSlug with an existing Style tag; ask the owner if the Style is uncertain.`
    );
  }

  const usageTags = item.usageNames?.length
    ? await Promise.all(item.usageNames.map((name) => ensureTagByTypeAndName(TagType.USAGE, name)))
    : baseTags.extraUsageTags;

  const slugBase = artworkId
    ? `pixiv-${artworkId}-${slugify(characterName || item.folder)}`
    : `manual-${slugify(characterName || item.folder)}`;
  const slug = await ensureUniqueContentSlug(slugBase);

  const imageUrls: string[] = [];
  for (let i = 0; i < imageFiles.length; i += 1) {
    const name = imageFiles[i];
    const buf = await fs.readFile(path.join(folderPath, name));
    const objectKey = `contents/${slug}/${String(i + 1).padStart(2, "0")}-${sanitizeFileName(name)}`;
    await uploadR2Object({ key: objectKey, body: buf, contentType: guessMime(name), contentLength: buf.byteLength });
    imageUrls.push(buildR2PublicUrl(objectKey));
  }

  const tagIds = Array.from(
    new Set([
      authorTag.id,
      typeTag.id,
      workTag.id,
      characterTag.id,
      ...styleTags.map((x) => x.id),
      ...usageTags.map((x) => x.id)
    ])
  );

  const content = await db.content.create({
    data: {
      title,
      slug,
      description:
        item.description?.trim() ||
        (artworkId
          ? `Imported from db image/cut/${item.folder}. Auto-enriched from Pixiv artwork ${artworkId}.`
          : sourceLink
            ? `Imported from db image/cut/${item.folder}. Source: ${sourceLink}`
            : `Imported from db image/cut/${item.folder}.`),
      coverImageUrl: imageUrls[0],
      sourceLink,
      storageFolder: slug,
      reviewStatus: defaults?.reviewStatus ?? ReviewStatus.PASSED,
      publishStatus: defaults?.publishStatus ?? PublishStatus.PUBLISHED,
      isVerified: (defaults?.reviewStatus ?? ReviewStatus.PASSED) === ReviewStatus.PASSED,
      contentTags: { create: tagIds.map((tagId) => ({ tagId })) },
      images: {
        create: imageUrls.map((imageUrl, sortOrder) => ({ imageUrl, sortOrder }))
      }
    },
    select: { id: true, slug: true, title: true }
  });

  const uploader = await db.user.findFirst({
    where: { role: UserRole.ADMIN },
    orderBy: { id: "asc" },
    select: { id: true }
  });

  if (!uploader) {
    throw new Error("No admin uploader user found");
  }

  const downloadResults: Array<{ sortOrder: number; url: string; fileName: string }> = [];

  for (let i = 0; i < downloadFiles.length; i += 1) {
    const sourceFileName = downloadFiles[i];
    const fileName = item.downloadFileLabels?.[sourceFileName]?.trim() || sourceFileName;
    const filePath = path.join(downloadFolderPath, sourceFileName);
    const fileInfo = await fs.stat(filePath);
    if (fileInfo.size > LARGE_DOWNLOAD_LIMIT_BYTES) {
      throw new Error(
        `Download file exceeds 200MB and must not be uploaded as a website download. Report it and use the owner-provided KK Archive mod link instead: ${path.relative(PROJECT_ROOT, filePath)} (${fileInfo.size} bytes)`
      );
    }
    const buf = await fs.readFile(filePath);
    const safe = sanitizeFileName(fileName);
    const ext = path.extname(safe).toLowerCase() || ".bin";
    const objectKey = `uploadfiles/${slug}/${String(i + 1).padStart(2, "0")}-download${ext}`;

    await uploadR2Object({ key: objectKey, body: buf, contentType: guessMime(fileName), contentLength: buf.byteLength });

    const file = await db.contentFile.create({
      data: {
        contentId: content.id,
        fileName,
        objectKey,
        mimeType: guessMime(fileName),
        byteSize: buf.byteLength,
        sortOrder: i,
        uploadedByUserId: uploader.id
      },
      select: { id: true }
    });

    const url = buildContentFileDownloadPath(file.id);
    await db.contentDownloadLink.create({ data: { contentId: content.id, url, sortOrder: i } });
    downloadResults.push({ sortOrder: i, url, fileName });
  }

  for (const apexDriveLink of getApexDriveLinks(item)) {
    const sortOrder = downloadResults.length;
    await db.contentDownloadLink.create({
      data: {
        contentId: content.id,
        url: apexDriveLink,
        sortOrder
      }
    });
    downloadResults.push({ sortOrder, url: apexDriveLink, fileName: "ApexDrive" });
  }

  if (item.tgLink?.trim()) {
    const sortOrder = downloadResults.length;
    await db.contentDownloadLink.create({
      data: {
        contentId: content.id,
        url: item.tgLink.trim(),
        sortOrder
      }
    });
    downloadResults.push({ sortOrder, url: item.tgLink.trim(), fileName: "TG" });
  }

  return {
    skipped: false,
    folder: item.folder,
    content,
    pixiv: {
      artworkId,
      title: pixiv.title,
      author: pixiv.author,
      tags: pixiv.tags
    },
    resolved: {
      finalTitle: title,
      finalAuthor: authorName,
      work: workTag.name,
      character: characterTag.name,
      type: typeTag.name,
      styles: styleTags.map((x) => x.name),
      usages: usageTags.map((x) => x.name)
    },
    imageCount: imageUrls.length,
    downloads: downloadResults
  };
}

async function main() {
  const queuePath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : DEFAULT_QUEUE;
  if (!existsSync(queuePath)) {
    throw new Error(`Queue file not found: ${queuePath}`);
  }

  const raw = await fs.readFile(queuePath, "utf8");
  const strippedRaw = raw.replace(/^\uFEFF/, "");
  let queue: QueueFile;
  try {
    queue = JSON.parse(strippedRaw) as QueueFile;
  } catch {
    const repairedRaw = repairQueueJson(strippedRaw);
    if (repairedRaw === strippedRaw) {
      throw new Error(`Queue file is invalid JSON: ${queuePath}`);
    }

    queue = JSON.parse(repairedRaw) as QueueFile;
    console.warn(`[CUT] Repaired illegal JSON tokens in ${queuePath}`);
  }

  if (!Array.isArray(queue.items) || queue.items.length === 0) {
    console.log(JSON.stringify({ queuePath, count: 0, results: [], note: "queue has no items" }, null, 2));
    return;
  }

  const aliasMap = await loadWorkAliasMap();
  const results = [] as unknown[];

  for (const item of queue.items) {
    const normalizedItem = normalizeQueueItem(item as RawQueueItem);

    if (!normalizedItem.folder) {
      results.push({ skipped: true, reason: "missing_folder", item: normalizedItem });
      continue;
    }

    try {
      const result = await importOne(normalizedItem, queue.defaults, aliasMap);
      results.push(result);
      console.log(`[CUT] ${normalizedItem.folder} -> ${"skipped" in result && result.skipped ? "SKIPPED" : "IMPORTED"}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ folder: normalizedItem.folder, failed: true, error: message });
      console.error(`[CUT] ${normalizedItem.folder} -> FAILED: ${message}`);
    }
  }

  console.log(JSON.stringify({ queuePath, count: queue.items.length, results }, null, 2));
}

const isDirectRun = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isDirectRun) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
