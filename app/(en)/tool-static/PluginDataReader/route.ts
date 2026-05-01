import { NextResponse } from "next/server";
import { readToolIndexHtml } from "./tool-files";

const EXOCLICK_TOOL_INTERSTITIAL_ENABLED =
  (process.env.NEXT_PUBLIC_EXOCLICK_TOOL_INTERSTITIAL_ENABLED?.trim() || "true") !== "false";
const EXOCLICK_TOOL_INTERSTITIAL_ZONE_ID =
  process.env.NEXT_PUBLIC_EXOCLICK_TOOL_INTERSTITIAL_ZONE_ID?.trim() || "5915410";
const EXOCLICK_TOOL_INTERSTITIAL_CLASS =
  process.env.NEXT_PUBLIC_EXOCLICK_TOOL_INTERSTITIAL_CLASS?.trim() || "eas6a97888e35";
const EXOCLICK_TOOL_INTERSTITIAL_SCRIPT_SRC =
  process.env.NEXT_PUBLIC_EXOCLICK_TOOL_INTERSTITIAL_SCRIPT_SRC?.trim() || "https://a.pemsrv.com/ad-provider.js";

function escapeHtmlAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function injectToolInterstitialSnippet(html: string) {
  if (
    !EXOCLICK_TOOL_INTERSTITIAL_ENABLED ||
    !EXOCLICK_TOOL_INTERSTITIAL_ZONE_ID ||
    !EXOCLICK_TOOL_INTERSTITIAL_CLASS ||
    !EXOCLICK_TOOL_INTERSTITIAL_SCRIPT_SRC
  ) {
    return html;
  }

  const safeZoneId = escapeHtmlAttr(EXOCLICK_TOOL_INTERSTITIAL_ZONE_ID);
  const safeZoneClass = escapeHtmlAttr(EXOCLICK_TOOL_INTERSTITIAL_CLASS);
  const safeScriptSrc = escapeHtmlAttr(EXOCLICK_TOOL_INTERSTITIAL_SCRIPT_SRC);

  if (html.includes(`data-zoneid="${safeZoneId}"`)) {
    return html;
  }

  const snippet = [
    `<script async type="application/javascript" src="${safeScriptSrc}"></script>`,
    `<ins class="${safeZoneClass}" data-zoneid="${safeZoneId}"></ins>`,
    `<script>(AdProvider = window.AdProvider || []).push({"serve": {}});</script>`
  ].join("\n");

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${snippet}\n</body>`);
  }

  return `${html}\n${snippet}`;
}

export async function GET() {
  const rawHtml = await readToolIndexHtml();
  const html = injectToolInterstitialSnippet(rawHtml);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
