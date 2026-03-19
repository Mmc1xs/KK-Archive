import { PublishStatus, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createR2DownloadUrl } from "@/lib/storage/r2";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const user = await getCurrentSession({ touchActivity: false });
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const routeParams = await params;
  const fileId = Number(routeParams.fileId);
  if (!Number.isInteger(fileId) || fileId <= 0) {
    return NextResponse.json({ error: "Invalid file id" }, { status: 400 });
  }

  const file = await db.contentFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      objectKey: true,
      fileName: true,
      content: {
        select: {
          publishStatus: true
        }
      }
    }
  });

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const isStaff = user.role === UserRole.ADMIN || user.role === UserRole.AUDIT;
  const canAccessByStatus =
    file.content.publishStatus === PublishStatus.PUBLISHED ||
    file.content.publishStatus === PublishStatus.SUMMIT;

  if (!isStaff && !canAccessByStatus) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const signedDownloadUrl = await createR2DownloadUrl({
    key: file.objectKey,
    fileName: file.fileName
  });

  return NextResponse.redirect(signedDownloadUrl);
}

