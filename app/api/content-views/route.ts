import { PublishStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { recordContentView } from "@/lib/content";
import { db } from "@/lib/db";

export const preferredRegion = "hkg1";

const BOT_USER_AGENT_PATTERN = /(bot|crawler|spider|headless|preview|facebookexternalhit|slurp|bingpreview)/i;

export async function POST(request: Request) {
  const userAgent = request.headers.get("user-agent") ?? "";
  if (BOT_USER_AGENT_PATTERN.test(userAgent)) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store"
      }
    });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const contentId = Number((payload as { contentId?: unknown }).contentId);
  if (!Number.isInteger(contentId) || contentId <= 0) {
    return NextResponse.json({ error: "Invalid content id" }, { status: 400 });
  }

  const content = await db.content.findFirst({
    where: {
      id: contentId,
      publishStatus: PublishStatus.PUBLISHED
    },
    select: {
      id: true
    }
  });

  if (!content) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store"
      }
    });
  }

  try {
    await recordContentView(content.id);
  } catch (error) {
    console.error("Failed to record content view", {
      contentId: content.id,
      error
    });
  }

  return new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
