import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { getSiteDownloadDemoContent, parseTelegramMediaSelections } from "@/lib/demo/site-download";
import {
  enqueueSiteDownloadDemoBackgroundUpload,
  getSiteDownloadDemoBackgroundUploadStatus
} from "@/lib/demo/site-download-background-queue";

type UploadRequestPayload = {
  selectedFiles?: unknown[];
};

async function requireAdminAndContent(contentIdRaw: string) {
  const user = await getCurrentSession({ touchActivity: false });
  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  if (user.role !== "ADMIN") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    };
  }

  const contentId = Number(contentIdRaw);
  if (!Number.isInteger(contentId) || contentId <= 0) {
    return {
      error: NextResponse.json({ error: "Invalid content id" }, { status: 400 })
    };
  }

  const content = await getSiteDownloadDemoContent(contentId);
  if (!content || !content.telegramSourceUrl) {
    return {
      error: NextResponse.json({ error: "TG source link not found for this content" }, { status: 404 })
    };
  }

  return {
    user,
    contentId,
    content
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contentId: string }> }
) {
  const routeParams = await params;
  const resolved = await requireAdminAndContent(routeParams.contentId);
  if ("error" in resolved) {
    return resolved.error;
  }

  return NextResponse.json({
    status: getSiteDownloadDemoBackgroundUploadStatus(resolved.contentId)
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ contentId: string }> }
) {
  const routeParams = await params;
  const resolved = await requireAdminAndContent(routeParams.contentId);
  if ("error" in resolved) {
    return resolved.error;
  }

  const payload = (await request.json().catch(() => null)) as UploadRequestPayload | null;
  const selections = parseTelegramMediaSelections(Array.isArray(payload?.selectedFiles) ? payload.selectedFiles : []);
  if (!selections.length) {
    return NextResponse.json({ error: "Please select at least one TG file" }, { status: 400 });
  }

  const status = enqueueSiteDownloadDemoBackgroundUpload({
    contentId: resolved.contentId,
    actorUserId: resolved.user.id,
    telegramSourceUrl: resolved.content.telegramSourceUrl!,
    selections
  });

  return NextResponse.json({
    queued: true,
    status
  });
}
