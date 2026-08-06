import { readFile } from "node:fs/promises";
import path from "node:path";

const TOOL_ROOT = path.join(process.cwd(), "public", "tool-static", "PluginDataReaderVue");

export function resolveVueToolFilePath(relativePath: string) {
  const filePath = path.resolve(TOOL_ROOT, relativePath);
  const relative = path.relative(TOOL_ROOT, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid Vue tool asset path.");
  }
  return filePath;
}

export async function readVueToolIndexHtml() {
  return readFile(path.join(TOOL_ROOT, "index.html"), "utf8");
}

export function getVueToolFileContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
    case ".map":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}
