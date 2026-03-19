import { NextResponse } from "next/server";
import { StaffUploadMethod, StaffUploadStatus } from "@prisma/client";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { buildContentFileDownloadPath, buildLegacyContentFileDownloadPath } from "@/lib/downloads/content-file-token";
import { buildR2PublicUrl, completeR2MultipartUpload } from "@/lib/storage/r2";
import { canAccessStaffUploadSession, canManageStaffUploads } from "@/lib/uploads";

type CompletePayload = {
  parts?: Array<{ ETag: string; PartNumber: number }>;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; uploadId: string }> }
) {
  const user = await getCurrentSession({ touchActivity: false });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageStaffUploads(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const routeParams = await params;
  const contentId = Number(routeParams.id);
  const uploadId = Number(routeParams.uploadId);
  const payload = (await request.json().catch(() => null)) as CompletePayload | null;

  if (!Number.isInteger(contentId) || contentId <= 0 || !Number.isInteger(uploadId) || uploadId <= 0) {
    return NextResponse.json({ error: "Invalid upload target" }, { status: 400 });
  }

  const upload = await db.staffUpload.findFirst({
    where: {
      id: uploadId,
      contentId
    },
    select: {
      id: true,
      contentId: true,
      uploaderId: true,
      originalFileName: true,
      objectKey: true,
      mimeType: true,
      byteSize: true,
      uploadMethod: true,
      status: true,
      r2UploadId: true
    }
  });

  if (!upload) {
    return NextResponse.json({ error: "Upload session not found" }, { status: 404 });
  }

  if (
    !canAccessStaffUploadSession({
      actorRole: user.role,
      actorId: user.id,
      uploaderId: upload.uploaderId
    })
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (upload.status !== StaffUploadStatus.UPLOADING) {
    return NextResponse.json({ error: "Upload session is not active" }, { status: 409 });
  }

  if (upload.uploadMethod === StaffUploadMethod.MULTIPART) {
    const parts = [...(payload?.parts ?? [])]
      .filter((item) => Number.isInteger(item.PartNumber) && item.PartNumber > 0 && item.ETag)
      .sort((a, b) => a.PartNumber - b.PartNumber);

    if (!upload.r2UploadId || parts.length === 0) {
      return NextResponse.json({ error: "Multipart uploads require completed parts" }, { status: 400 });
    }

    await completeR2MultipartUpload({
      key: upload.objectKey,
      uploadId: upload.r2UploadId,
      parts
    });
  }

  const existingHostedFile = await db.contentFile.findFirst({
    where: {
      contentId: upload.contentId,
      objectKey: upload.objectKey
    },
    select: { id: true }
  });
  const maxSortOrder = await db.contentFile.aggregate({
    where: {
      contentId: upload.contentId
    },
    _max: {
      sortOrder: true
    }
  });

  const hostedFile = existingHostedFile
    ? await db.contentFile.update({
        where: { id: existingHostedFile.id },
        data: {
          staffUploadId: upload.id,
          fileName: upload.originalFileName,
          mimeType: upload.mimeType,
          byteSize: upload.byteSize,
          uploadedByUserId: upload.uploaderId
        },
        include: {
          uploadedBy: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true
            }
          }
        }
      })
    : await db.contentFile.create({
        data: {
          contentId: upload.contentId,
          staffUploadId: upload.id,
          fileName: upload.originalFileName,
          objectKey: upload.objectKey,
          mimeType: upload.mimeType,
          byteSize: upload.byteSize,
          sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
          uploadedByUserId: upload.uploaderId
        },
        include: {
          uploadedBy: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true
            }
          }
        }
      });

  const hostedDownloadUrl = buildContentFileDownloadPath(hostedFile.id);
  const legacyHostedDownloadUrlById = buildLegacyContentFileDownloadPath(hostedFile.id);
  const legacyHostedDownloadUrlByPublic = buildR2PublicUrl(upload.objectKey);
  const existingDownloadLink = await db.contentDownloadLink.findFirst({
    where: {
      contentId: upload.contentId,
      url: hostedDownloadUrl
    },
    select: { id: true }
  });
  const legacyDownloadLink = await db.contentDownloadLink.findFirst({
    where: {
      contentId: upload.contentId,
      url: legacyHostedDownloadUrlByPublic
    },
    select: { id: true }
  });
  const legacyIdDownloadLink = await db.contentDownloadLink.findFirst({
    where: {
      contentId: upload.contentId,
      url: legacyHostedDownloadUrlById
    },
    select: { id: true }
  });

  if (!existingDownloadLink && legacyIdDownloadLink) {
    await db.contentDownloadLink.update({
      where: { id: legacyIdDownloadLink.id },
      data: { url: hostedDownloadUrl }
    });
  } else if (!existingDownloadLink && legacyDownloadLink) {
    await db.contentDownloadLink.update({
      where: { id: legacyDownloadLink.id },
      data: { url: hostedDownloadUrl }
    });
  } else if (!existingDownloadLink) {
    const maxDownloadSortOrder = await db.contentDownloadLink.aggregate({
      where: {
        contentId: upload.contentId
      },
      _max: {
        sortOrder: true
      }
    });

    await db.contentDownloadLink.create({
      data: {
        contentId: upload.contentId,
        url: hostedDownloadUrl,
        sortOrder: (maxDownloadSortOrder._max.sortOrder ?? -1) + 1
      }
    });
  }

  await db.contentDownloadLink.deleteMany({
    where: {
      contentId: upload.contentId,
      url: {
        in: [legacyHostedDownloadUrlById, legacyHostedDownloadUrlByPublic]
      }
    }
  });

  await db.staffUpload.update({
    where: { id: upload.id },
    data: {
      status: StaffUploadStatus.COMPLETED,
      completedAt: new Date(),
      errorMessage: null
    }
  });

  return NextResponse.json({
    hostedFile,
    hostedDownloadUrl
  });
}
