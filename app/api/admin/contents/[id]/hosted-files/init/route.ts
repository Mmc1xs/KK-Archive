import { NextResponse } from "next/server";
import { StaffUploadMethod } from "@prisma/client";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createR2MultipartUpload, createR2SingleUploadUrl } from "@/lib/storage/r2";
import {
  buildUniqueHostedFileObjectKey,
  canManageStaffUploads,
  ensureContentStorageFolder,
  MULTIPART_THRESHOLD_BYTES,
  parseStaffUploadInitInput,
  sanitizeUploadFileName
} from "@/lib/uploads";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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
  if (!Number.isInteger(contentId) || contentId <= 0) {
    return NextResponse.json({ error: "Invalid content id" }, { status: 400 });
  }

  const content = await db.content.findUnique({
    where: { id: contentId },
    select: { id: true }
  });
  if (!content) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = parseStaffUploadInitInput(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid upload payload" }, { status: 400 });
  }

  const storageFolder = await ensureContentStorageFolder(contentId);
  if (!storageFolder) {
    return NextResponse.json({ error: "Unable to resolve storage folder for this content" }, { status: 500 });
  }

  const safeFileName = sanitizeUploadFileName(parsed.data.fileName);
  const uploadMethod =
    parsed.data.byteSize >= MULTIPART_THRESHOLD_BYTES ? StaffUploadMethod.MULTIPART : StaffUploadMethod.SINGLE;
  const objectKey = await buildUniqueHostedFileObjectKey(contentId, storageFolder, safeFileName);
  const r2UploadId =
    uploadMethod === StaffUploadMethod.MULTIPART
      ? await createR2MultipartUpload({
          key: objectKey,
          contentType: parsed.data.mimeType
        })
      : null;

  const upload = await db.staffUpload.create({
    data: {
      contentId,
      uploaderId: user.id,
      originalFileName: safeFileName,
      objectKey,
      mimeType: parsed.data.mimeType,
      byteSize: parsed.data.byteSize,
      uploadMethod,
      status: "UPLOADING",
      r2UploadId
    },
    select: {
      id: true,
      contentId: true,
      originalFileName: true,
      objectKey: true,
      mimeType: true,
      byteSize: true,
      uploadMethod: true,
      status: true,
      r2UploadId: true
    }
  });

  return NextResponse.json({
    upload,
    storageFolder,
    directUploadUrl:
      uploadMethod === StaffUploadMethod.SINGLE
        ? await createR2SingleUploadUrl({
            key: objectKey,
            contentType: parsed.data.mimeType
          })
        : null,
    limits: {
      maxBytes: 2 * 1024 * 1024 * 1024,
      multipartThresholdBytes: MULTIPART_THRESHOLD_BYTES
    },
    note:
      uploadMethod === StaffUploadMethod.MULTIPART
        ? "Multipart upload session created."
        : "Single direct upload URL created."
  });
}
