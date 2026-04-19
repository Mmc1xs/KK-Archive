import { NextResponse } from "next/server";
import { readToolIndexHtml } from "./tool-files";

export async function GET() {
  const html = await readToolIndexHtml();
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
