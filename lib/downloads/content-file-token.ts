import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_VERSION = "v1";

function getDownloadTokenSecret() {
  if (process.env.DOWNLOAD_TOKEN_SECRET) {
    return process.env.DOWNLOAD_TOKEN_SECRET;
  }

  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing DOWNLOAD_TOKEN_SECRET (or SESSION_SECRET) in production.");
  }

  return "dev-download-token-secret";
}

function sign(value: string) {
  return createHmac("sha256", getDownloadTokenSecret()).update(value).digest("hex");
}

export function createContentFileToken(fileId: number) {
  const payload = Buffer.from(`${TOKEN_VERSION}:${fileId}`).toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function parseContentFileToken(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expected = sign(payload);
  const isValid =
    Buffer.byteLength(signature) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

  if (!isValid) {
    return null;
  }

  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  const [version, fileIdRaw] = decoded.split(":");
  if (version !== TOKEN_VERSION) {
    return null;
  }

  const fileId = Number(fileIdRaw);
  if (!Number.isInteger(fileId) || fileId <= 0) {
    return null;
  }

  return fileId;
}

export function buildContentFileDownloadPath(fileId: number) {
  return `/api/downloads/content-file/token/${createContentFileToken(fileId)}`;
}

export function buildLegacyContentFileDownloadPath(fileId: number) {
  return `/api/downloads/content-file/${fileId}`;
}
