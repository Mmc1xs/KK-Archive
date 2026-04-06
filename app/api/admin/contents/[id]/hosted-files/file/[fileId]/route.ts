import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  buildContentFileDownloadPath,
  buildLegacyContentFileDownloadPath
} from "@/lib/downloads/content-file-token";
import { buildR2PublicUrl, deleteR2Object } from "@/lib/storage/r2";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const user = await getCurrentSession({ touchActivity: false });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const routeParams = await params;
  const contentId = Number(routeParams.id);
  const fileId = Number(routeParams.fileId);

  if (!Number.isInteger(contentId) || contentId <= 0 || !Number.isInteger(fileId) || fileId <= 0) {
    return NextResponse.json({ error: "Invalid hosted file target" }, { status: 400 });
  }

  const hostedFile = await db.contentFile.findFirst({
    where: {
      id: fileId,
      contentId
    },
    select: {
      id: true,
      content: {
        select: {
          slug: true
        }
      },
      fileName: true,
      objectKey: true,
      staffUploadId: true
    }
  });

  if (!hostedFile) {
    return NextResponse.json({ error: "Hosted file not found" }, { status: 404 });
  }

  const hostedDownloadUrl = buildContentFileDownloadPath(hostedFile.id);
  const legacyHostedDownloadUrlById = buildLegacyContentFileDownloadPath(hostedFile.id);
  const legacyHostedDownloadUrlByPublic = buildR2PublicUrl(hostedFile.objectKey);

  await db.$transaction(async (tx) => {
    await tx.contentDownloadLink.deleteMany({
      where: {
        contentId,
        url: {
          in: [hostedDownloadUrl, legacyHostedDownloadUrlById, legacyHostedDownloadUrlByPublic]
        }
      }
    });

    await tx.contentFile.delete({
      where: {
        id: hostedFile.id
      }
    });

    if (hostedFile.staffUploadId) {
      await tx.staffUpload.deleteMany({
        where: {
          id: hostedFile.staffUploadId
        }
      });
    }
  });

  let storageCleanupWarning: string | null = null;

  try {
    await deleteR2Object(hostedFile.objectKey);
  } catch (error) {
    console.error("Failed to delete hosted file from R2", {
      contentId,
      fileId: hostedFile.id,
      objectKey: hostedFile.objectKey,
      error
    });
    storageCleanupWarning = "Hosted file metadata was removed, but R2 cleanup failed. Please check storage manually.";
  }

  revalidatePath(`/admin/contents/${contentId}/edit`);
  revalidatePath(`/contents/${hostedFile.content.slug}`);
  revalidatePath(`/zh-CN/contents/${hostedFile.content.slug}`);
  revalidatePath(`/ja/contents/${hostedFile.content.slug}`);

  return NextResponse.json({
    removedFileId: hostedFile.id,
    removedFileName: hostedFile.fileName,
    removedHostedDownloadUrl: hostedDownloadUrl,
    warning: storageCleanupWarning
  });
}
