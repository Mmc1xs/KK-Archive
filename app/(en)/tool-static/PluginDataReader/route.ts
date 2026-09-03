import { NextResponse } from "next/server";
import { readVueToolIndexHtml } from "../PluginDataReaderVue/tool-files";

const EXOCLICK_TOOL_STICKY_ENABLED =
  (
    process.env.NEXT_PUBLIC_EXOCLICK_TOOL_STICKY_ENABLED?.trim() ||
    process.env.NEXT_PUBLIC_EXOCLICK_HOME_STICKY_ENABLED?.trim() ||
    "true"
  ) !== "false";
const EXOCLICK_TOOL_STICKY_ZONE_ID =
  process.env.NEXT_PUBLIC_EXOCLICK_TOOL_STICKY_ZONE_ID?.trim() ||
  process.env.NEXT_PUBLIC_EXOCLICK_HOME_STICKY_ZONE_ID?.trim() ||
  "5915396";
const EXOCLICK_TOOL_STICKY_CLASS =
  process.env.NEXT_PUBLIC_EXOCLICK_TOOL_STICKY_CLASS?.trim() ||
  process.env.NEXT_PUBLIC_EXOCLICK_HOME_STICKY_CLASS?.trim() ||
  "eas6a97888e17";
const EXOCLICK_TOOL_STICKY_SCRIPT_SRC =
  process.env.NEXT_PUBLIC_EXOCLICK_TOOL_STICKY_SCRIPT_SRC?.trim() || "https://a.magsrv.com/ad-provider.js";

function escapeHtmlAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function injectToolStickySnippet(html: string) {
  if (
    !EXOCLICK_TOOL_STICKY_ENABLED ||
    !EXOCLICK_TOOL_STICKY_ZONE_ID ||
    !EXOCLICK_TOOL_STICKY_CLASS ||
    !EXOCLICK_TOOL_STICKY_SCRIPT_SRC
  ) {
    return html;
  }

  const safeZoneId = escapeHtmlAttr(EXOCLICK_TOOL_STICKY_ZONE_ID);
  const safeZoneClass = escapeHtmlAttr(EXOCLICK_TOOL_STICKY_CLASS);
  const safeScriptSrc = escapeHtmlAttr(EXOCLICK_TOOL_STICKY_SCRIPT_SRC);

  if (html.includes(`data-zoneid="${safeZoneId}"`)) {
    return html;
  }

  const snippet = [
    `<style>
.kk-tool-sticky-ad {
  position: fixed;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  z-index: 50;
  width: min(728px, calc(100vw - 28px));
  pointer-events: none;
}
.kk-tool-sticky-ad-inner {
  width: 728px;
  height: 90px;
  max-width: min(728px, calc(100vw - 28px));
  pointer-events: auto;
}
.kk-tool-sticky-ad-inner ins {
  display: block;
  width: 728px !important;
  height: 90px !important;
  max-width: 728px;
  max-height: 90px;
  overflow: hidden;
}
@media (max-width: 860px) {
  .kk-tool-sticky-ad {
    display: none;
  }
}
</style>`,
    `<div class="kk-tool-sticky-ad"><div class="kk-tool-sticky-ad-inner"><ins class="${safeZoneClass}" data-zoneid="${safeZoneId}"></ins></div></div>`,
    `<script async type="application/javascript" src="${safeScriptSrc}"></script>`,
    `<script>(window.AdProvider = window.AdProvider || []).push({"serve": {}});</script>`
  ].join("\n");

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${snippet}\n</body>`);
  }

  return `${html}\n${snippet}`;
}

export async function GET() {
  const rawHtml = (await readVueToolIndexHtml()).replace(
    /\/tool-static\/PluginDataReaderVue\//g,
    "/tool-static/PluginDataReader/"
  );
  const html = injectToolStickySnippet(rawHtml);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
