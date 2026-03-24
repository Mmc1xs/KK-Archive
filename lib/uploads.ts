import { UserRole } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";

export const MAX_STAFF_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;
export const MULTIPART_THRESHOLD_BYTES = 100 * 1024 * 1024;

const uploadInitSchema = z.object({
  fileName: z.string().trim().min(1, "File name is required").max(255, "File name is too long"),
  mimeType: z.string().trim().min(1, "Mime type is required").max(255, "Mime type is too long"),
  byteSize: z.number().int().min(1, "File size must be greater than zero").max(MAX_STAFF_UPLOAD_BYTES, "File size exceeds 2GB limit")
});

export function parseStaffUploadInitInput(input: unknown) {
  return uploadInitSchema.safeParse(input);
}

export function canManageStaffUploads(role: UserRole) {
  return role === UserRole.ADMIN || role === UserRole.AUDIT;
}

export function canAccessStaffUploadSession(params: {
  actorRole: UserRole;
  actorId: number;
  uploaderId: number;
}) {
  if (params.actorRole === UserRole.ADMIN) {
    return true;
  }

  return params.actorId === params.uploaderId;
}

export function sanitizeUploadFileName(fileName: string) {
  const normalized = fileName.normalize("NFKC").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim();
  return normalized || "file.bin";
}

function extractFolderFromUrl(url?: string | null) {
  if (!url) {
    return null;
  }

  const match = url.match(/\/contents\/([^/]+)\//i);
  return match?.[1] ?? null;
}

export function resolveContentStorageFolderValue(content: {
  id: number;
  storageFolder?: string | null;
  coverImageUrl?: string | null;
  images?: Array<{ imageUrl: string }>;
}) {
  if (content.storageFolder?.trim()) {
    return content.storageFolder.trim();
  }

  const folderFromCover = extractFolderFromUrl(content.coverImageUrl);
  if (folderFromCover) {
    return folderFromCover;
  }

  for (const image of content.images ?? []) {
    const folderFromImage = extractFolderFromUrl(image.imageUrl);
    if (folderFromImage) {
      return folderFromImage;
    }
  }

  return String(content.id);
}

export async function ensureContentStorageFolder(contentId: number) {
  const content = await db.content.findUnique({
    where: { id: contentId },
    select: {
      id: true,
      storageFolder: true,
      coverImageUrl: true,
      images: {
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { imageUrl: true }
      }
    }
  });

  if (!content) {
    return null;
  }

  const nextStorageFolder = resolveContentStorageFolderValue(content);
  if (content.storageFolder !== nextStorageFolder) {
    await db.content.update({
      where: { id: contentId },
      data: {
        storageFolder: nextStorageFolder
      }
    });
  }

  return nextStorageFolder;
}

export function buildHostedFileObjectKey(storageFolder: string, fileName: string) {
  return `uploadfiles/${storageFolder}/${sanitizeUploadFileName(fileName)}`;
}

function splitBaseNameAndExtension(fileName: string) {
  const extIndex = fileName.lastIndexOf(".");
  if (extIndex <= 0) {
    return { baseName: fileName, extension: "" };
  }

  return {
    baseName: fileName.slice(0, extIndex),
    extension: fileName.slice(extIndex)
  };
}

export async function buildUniqueHostedFileObjectKey(contentId: number, storageFolder: string, fileName: string) {
  const safeFileName = sanitizeUploadFileName(fileName);
  const { baseName, extension } = splitBaseNameAndExtension(safeFileName);

  let candidate = buildHostedFileObjectKey(storageFolder, safeFileName);
  let counter = 2;

  while (
    await db.staffUpload.findFirst({
      where: {
        contentId,
        objectKey: candidate
      },
      select: { id: true }
    })
  ) {
    candidate = buildHostedFileObjectKey(storageFolder, `${baseName}-${counter}${extension}`);
    counter += 1;
  }

  return candidate;
}
