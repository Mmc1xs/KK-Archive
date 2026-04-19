import { readFile } from "node:fs/promises";
import path from "node:path";

const TOOL_ROOT = path.join(process.cwd(), "public", "tool-static", "PluginDataReader");

export function resolveToolFilePath(relativePath: string) {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\\|\/|$))+/, "");
  return path.join(TOOL_ROOT, normalized);
}

export async function readToolIndexHtml() {
  return readFile(path.join(TOOL_ROOT, "index.html"), "utf8");
}

export function getToolFileContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".wasm":
      return "application/wasm";
    case ".dat":
      return "application/octet-stream";
    case ".png":
      return "image/png";
    case ".ico":
      return "image/x-icon";
    case ".svg":
      return "image/svg+xml";
    case ".map":
      return "application/json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}
