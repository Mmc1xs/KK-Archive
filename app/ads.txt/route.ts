import { NextResponse } from "next/server";

const ADSENSE_EXCHANGE_DOMAIN = "google.com";
const ADSENSE_ACCOUNT_TYPE = "DIRECT";
const ADSENSE_CERTIFICATION_AUTHORITY_ID = "f08c47fec0942fa0";

function getExtraAdsTxtLines() {
  const raw = process.env.ADS_TXT_EXTRA_LINES?.replace(/\\n/g, "\n").trim();

  if (!raw) {
    return [];
  }

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

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
  const lines = getExtraAdsTxtLines();

  if (publisherAccountId) {
    lines.unshift(
      [
        ADSENSE_EXCHANGE_DOMAIN,
        `pub-${publisherAccountId}`,
        ADSENSE_ACCOUNT_TYPE,
        ADSENSE_CERTIFICATION_AUTHORITY_ID
      ].join(", ")
    );
  }

  if (!lines.length) {
    return new NextResponse("ads.txt entries are not configured.\n", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }

  return new NextResponse(`${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
