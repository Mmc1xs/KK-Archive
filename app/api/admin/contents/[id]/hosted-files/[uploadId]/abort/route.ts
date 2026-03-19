import { NextResponse } from "next/server";
import { StaffUploadStatus } from "@prisma/client";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { abortR2MultipartUpload } from "@/lib/storage/r2";
import { canAccessStaffUploadSession, canManageStaffUploads } from "@/lib/uploads";

export async function POST(
  _request: Request,
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
      uploaderId: true,
      status: true,
      objectKey: true,
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

  if (upload.status === StaffUploadStatus.COMPLETED) {
    return NextResponse.json({ error: "Completed upload sessions cannot be aborted" }, { status: 409 });
  }

  if (upload.r2UploadId) {
    await abortR2MultipartUpload({
      key: upload.objectKey,
      uploadId: upload.r2UploadId
    }).catch(() => null);
  }

  await db.staffUpload.update({
    where: { id: uploadId },
    data: {
      status: StaffUploadStatus.ABORTED,
      errorMessage: null
    }
  });

  return NextResponse.json({ ok: true });
}
