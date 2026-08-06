import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getVueToolFileContentType, resolveVueToolFilePath } from "../tool-files";

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: pathParts } = await params;
  let filePath: string;

  try {
    filePath = resolveVueToolFilePath(pathParts.join("/"));
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  if (!existsSync(filePath)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const body = await readFile(filePath);
  return new NextResponse(body, {
    headers: {
      "Content-Type": getVueToolFileContentType(filePath),
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}
