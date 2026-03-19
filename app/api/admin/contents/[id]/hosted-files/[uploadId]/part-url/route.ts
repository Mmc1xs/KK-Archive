import { NextResponse } from "next/server";
import { StaffUploadMethod, StaffUploadStatus } from "@prisma/client";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createR2MultipartPartUploadUrl } from "@/lib/storage/r2";
import { canAccessStaffUploadSession, canManageStaffUploads } from "@/lib/uploads";

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
  const payload = (await request.json().catch(() => null)) as { partNumber?: number } | null;
  const partNumber = Number(payload?.partNumber);

  if (
    !Number.isInteger(contentId) ||
    contentId <= 0 ||
    !Number.isInteger(uploadId) ||
    uploadId <= 0 ||
    !Number.isInteger(partNumber) ||
    partNumber <= 0
  ) {
    return NextResponse.json({ error: "Invalid multipart upload target" }, { status: 400 });
  }

  const upload = await db.staffUpload.findFirst({
    where: {
      id: uploadId,
      contentId
    },
    select: {
      id: true,
      uploaderId: true,
      objectKey: true,
      uploadMethod: true,
      status: true,
      r2UploadId: true
    }
  });

  if (!upload) {
    return NextResponse.json({ error: "Upload session not found" }, { status: 404 });
  }

  if (upload.uploadMethod !== StaffUploadMethod.MULTIPART || !upload.r2UploadId) {
    return NextResponse.json({ error: "Upload session is not multipart" }, { status: 409 });
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

  const url = await createR2MultipartPartUploadUrl({
    key: upload.objectKey,
    uploadId: upload.r2UploadId,
    partNumber
  });

  return NextResponse.json({ url });
}
