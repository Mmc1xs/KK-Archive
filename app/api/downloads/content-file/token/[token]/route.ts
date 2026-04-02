import { PublishStatus, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { recordContentDownload } from "@/lib/content";
import { parseContentFileToken } from "@/lib/downloads/content-file-token";
import { db } from "@/lib/db";
import { createR2DownloadUrl } from "@/lib/storage/r2";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const user = await getCurrentSession({ touchActivity: false });
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const routeParams = await params;
  const fileId = parseContentFileToken(routeParams.token);
  if (!fileId) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const file = await db.contentFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      objectKey: true,
      fileName: true,
      content: {
        select: {
          id: true,
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

  try {
    await recordContentDownload(file.content.id);
  } catch (error) {
    console.error("Failed to record content download", {
      fileId: file.id,
      contentId: file.content.id,
      error
    });
  }

  return NextResponse.redirect(signedDownloadUrl);
}
