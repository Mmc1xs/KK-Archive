import { NextResponse } from "next/server";
import { readToolIndexHtml } from "../PluginDataReader/tool-files";

function injectArchiveReturnLink(html: string) {
  const snippet = `
<style id="kk-archive-return-link-style">
  .kk-archive-return-link {
    position: fixed;
    top: 16px;
    left: 16px;
    z-index: 2147483647;
    display: inline-flex;
    align-items: center;
    min-height: 42px;
    padding: 8px 16px;
    border: 1px solid rgba(111, 205, 255, 0.72);
    border-radius: 999px;
    background: rgba(12, 20, 30, 0.92);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28);
    color: #f4fbff;
    font: 600 15px/1.2 system-ui, sans-serif;
    text-decoration: none;
    backdrop-filter: blur(10px);
  }

  .kk-archive-return-link:hover,
  .kk-archive-return-link:focus-visible {
    border-color: #8cddff;
    background: rgba(21, 43, 60, 0.96);
    color: #ffffff;
    outline: 3px solid rgba(84, 187, 236, 0.32);
    outline-offset: 2px;
  }
</style>
<a class="kk-archive-return-link" href="/" target="_top" aria-label="Return to KK Archive">&larr; KK Archive</a>`;

  if (/<body(?:\s[^>]*)?>/i.test(html)) {
    return html.replace(/<body(?:\s[^>]*)?>/i, (bodyTag) => `${bodyTag}\n${snippet}`);
  }

  return `${snippet}\n${html}`;
}

export async function GET() {
  const routedHtml = (await readToolIndexHtml()).replace(
    /\/tool-static\/PluginDataReader\//g,
    "/tool-static/PluginDataReaderLegacy/"
  );
  const html = injectArchiveReturnLink(routedHtml);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
