import { NextResponse } from "next/server";

const ADSENSE_EXCHANGE_DOMAIN = "google.com";
const ADSENSE_ACCOUNT_TYPE = "DIRECT";
const ADSENSE_CERTIFICATION_AUTHORITY_ID = "f08c47fec0942fa0";

function getPublisherAccountId() {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim();

  if (!clientId) {
    return null;
  }

  const normalized = clientId.startsWith("ca-pub-") ? clientId.slice("ca-pub-".length) : clientId;

  return /^\d+$/.test(normalized) ? normalized : null;
}

export function GET() {
  const publisherAccountId = getPublisherAccountId();

  if (!publisherAccountId) {
    return new NextResponse("AdSense publisher ID is not configured.\n", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }

  const body = [
    [
      ADSENSE_EXCHANGE_DOMAIN,
      `pub-${publisherAccountId}`,
      ADSENSE_ACCOUNT_TYPE,
      ADSENSE_CERTIFICATION_AUTHORITY_ID
    ].join(", ")
  ].join("\n");

  return new NextResponse(`${body}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
