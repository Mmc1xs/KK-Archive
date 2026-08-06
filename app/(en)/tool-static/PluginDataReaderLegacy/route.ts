import { NextResponse } from "next/server";
import { readToolIndexHtml } from "../PluginDataReader/tool-files";

export async function GET() {
  const html = (await readToolIndexHtml()).replace(
    /\/tool-static\/PluginDataReader\//g,
    "/tool-static/PluginDataReaderLegacy/"
  );

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
