import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { getSiteDownloadDemoContent, parseTelegramMediaSelections, uploadSiteDownloadDemoSelections } from "@/lib/demo/site-download";

type UploadRequestPayload = {
  selectedFiles?: unknown[];
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ contentId: string }> }
) {
  const user = await getCurrentSession({ touchActivity: false });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const routeParams = await params;
  const contentId = Number(routeParams.contentId);
  if (!Number.isInteger(contentId) || contentId <= 0) {
    return NextResponse.json({ error: "Invalid content id" }, { status: 400 });
  }

  const content = await getSiteDownloadDemoContent(contentId);
  if (!content || !content.telegramSourceUrl) {
    return NextResponse.json({ error: "Telegram source link not found for this content" }, { status: 404 });
  }

  const payload = (await request.json().catch(() => null)) as UploadRequestPayload | null;
  const selections = parseTelegramMediaSelections(Array.isArray(payload?.selectedFiles) ? payload.selectedFiles : []);
  if (!selections.length) {
    return NextResponse.json({ error: "Please select at least one Telegram file" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const writeEvent = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      void (async () => {
        try {
          writeEvent({
            type: "started",
            totalFiles: selections.length
          });

          await uploadSiteDownloadDemoSelections({
            contentId,
            actorUserId: user.id,
            telegramSourceUrl: content.telegramSourceUrl!,
            selections,
            onProgress(progress) {
              writeEvent({
                type: "progress",
                progress
              });
            }
          });

          const refreshed = await getSiteDownloadDemoContent(contentId);
          writeEvent({
            type: "complete",
            uploadedCount: selections.length,
            hostedFileCount: refreshed?.hostedFiles.length ?? 0
          });
        } catch (error) {
          writeEvent({
            type: "error",
            error: error instanceof Error ? error.message : "Upload failed"
          });
        } finally {
          controller.close();
        }
      })();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
