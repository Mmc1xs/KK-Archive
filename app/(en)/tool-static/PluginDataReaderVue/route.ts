import { NextResponse } from "next/server";
import { readVueToolIndexHtml } from "./tool-files";

export async function GET() {
  const html = await readVueToolIndexHtml();
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
