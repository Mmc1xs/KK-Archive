import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getToolFileContentType, resolveToolFilePath } from "../tool-files";

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: pathParts } = await params;
  const filePath = resolveToolFilePath(pathParts.join("/"));

  if (!existsSync(filePath)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const body = await readFile(filePath);
  return new NextResponse(body, {
    headers: {
      "Content-Type": getToolFileContentType(filePath),
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}
