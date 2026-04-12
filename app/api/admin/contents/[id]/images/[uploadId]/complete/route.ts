import { NextResponse } from "next/server";
import { StaffUploadMethod, StaffUploadStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
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

  const imageUrl = buildR2PublicUrl(upload.objectKey);
  const existingImage = await db.contentImage.findFirst({
    where: {
      contentId: upload.contentId,
      imageUrl
    },
    select: { id: true }
  });
  const maxSortOrder = await db.contentImage.aggregate({
    where: {
      contentId: upload.contentId
    },
    _max: {
      sortOrder: true
    }
  });

  const contentImage = existingImage
    ? await db.contentImage.update({
        where: { id: existingImage.id },
        data: {
          imageUrl
        },
        select: {
          id: true,
          imageUrl: true
        }
      })
    : await db.contentImage.create({
        data: {
          contentId: upload.contentId,
          imageUrl,
          sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1
        },
        select: {
          id: true,
          imageUrl: true
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

  const content = await db.content.findUnique({
    where: { id: upload.contentId },
    select: {
      slug: true
    }
  });

  if (content) {
    revalidatePath(`/admin/contents/${upload.contentId}/edit`);
    revalidatePath(`/contents/${content.slug}`);
    revalidatePath(`/zh-CN/contents/${content.slug}`);
    revalidatePath(`/ja/contents/${content.slug}`);
  }

  return NextResponse.json({
    contentImage,
    imageUrl
  });
}
