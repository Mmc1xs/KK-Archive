import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { buildContentFileDownloadPath } from "@/lib/downloads/content-file-token";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const user = await getCurrentSession({ touchActivity: false });
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const isStaff = user.role === "ADMIN" || user.role === "AUDIT";
  if (!isStaff) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const routeParams = await params;
  const fileId = Number(routeParams.fileId);
  if (!Number.isInteger(fileId) || fileId <= 0) {
    return NextResponse.json({ error: "Invalid file id" }, { status: 400 });
  }

  const file = await db.contentFile.findUnique({
    where: { id: fileId },
    select: { id: true }
  });

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  return NextResponse.redirect(new URL(buildContentFileDownloadPath(file.id), request.url), 307);
}
