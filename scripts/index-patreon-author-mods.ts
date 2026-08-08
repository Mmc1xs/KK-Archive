import fs from "node:fs";
import path from "node:path";
import { dbModsRoot, resolveWorkflowPath } from "./workflow-paths";

const MOD_EXTENSIONS = [".zipmod", ".zip", ".7z", ".rar"];
const CLOUD_DOWNLOAD_HOSTS = ["mega.nz", "mega.co.nz"];

type AttachmentSource = "api" | "html" | "content" | "mega" | "external";

type AttachmentCandidate = {
  id?: string;
  name: string;
  url?: string;
  downloadUrl?: string;
  sizeBytes?: number;
  source: AttachmentSource;
  host?: string;
  kind?: "mod-file" | "cloud-link" | "external-link";
};

type PostCandidate = {
  id?: string;
  title: string;
  url: string;
  publishedAt?: string;
  isPaid?: boolean | null;
  attachments: AttachmentCandidate[];
};

type IndexOutput = {
  generatedAt: string;
  sourceUrl: string;
  authorSlug: string;
  mode: "index-only";
  env: {
    hasCookie: boolean;
    cookieVariable: string | null;
  };
  summary: {
    postCount: number;
    postsWithDownloads: number;
    postsWithModFiles: number;
    attachmentCount: number;
    modAttachmentCount: number;
    cloudDownloadCount: number;
    megaLinkCount: number;
  };
  warnings: string[];
  posts: PostCandidate[];
};

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args.set(key, true);
    } else {
      args.set(key, next);
      i += 1;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage:
  npm run mods:patreon:index -- --url <patreon creator/post URL> [--author <folder-slug>] [--out <index.json>] [--max-pages 3] [--deep-html] [--deep-offset 0] [--deep-limit 50]

Examples:
  npm run mods:patreon:index -- --url https://www.patreon.com/<creator> --author author-name
  npm run mods:patreon:index -- --url https://www.patreon.com/<creator> --author author-name --deep-html
  npm run mods:patreon:index -- --url https://www.patreon.com/<creator> --author author-name --max-pages 2 --deep-html --deep-offset 50 --deep-limit 50
  npm run mods:patreon:index -- --url https://www.patreon.com/posts/example-123456 --author author-name

Safety:
  - Reads PATREON_COOKIE, PATREON_SESSION_ID, or legacy PATREON_sessoinid from .env/.env.local.
  - Never prints the cookie/session value.
  - Only writes an index JSON. It does not download files and does not touch db mods/up_mod.
  - MEGA links are indexed as cloud links only; this script does not fetch or download from MEGA.
`);
}

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function loadLocalEnv() {
  loadEnvFile(path.join(process.cwd(), ".env"));
  loadEnvFile(path.join(process.cwd(), ".env.local"));
}

function getPatreonCookie(): { cookie: string | null; variable: string | null } {
  if (process.env.PATREON_COOKIE) return { cookie: process.env.PATREON_COOKIE, variable: "PATREON_COOKIE" };
  if (process.env.PATREON_SESSION_ID) return { cookie: `session_id=${process.env.PATREON_SESSION_ID}`, variable: "PATREON_SESSION_ID" };
  // Legacy typo kept intentionally so existing local .env files do not block indexing.
  if (process.env.PATREON_sessoinid) return { cookie: `session_id=${process.env.PATREON_sessoinid}`, variable: "PATREON_sessoinid" };
  return { cookie: null, variable: null };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[^a-z0-9\u4e00-\u9fff._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "patreon-author";
}

function htmlDecode(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\\u002F/g, "/")
    .replace(/\\u003D/g, "=")
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/");
}

function stripTrailingUrlJunk(url: string) {
  return url
    .replace(/\\+$/g, "")
    .replace(/[\"'),.;]+$/g, "")
    .replace(/&nbsp;.*$/g, "")
    .replace(/<.*$/g, "");
}

function normalizeUrl(url: string, base = "https://www.patreon.com") {
  try {
    return new URL(stripTrailingUrlJunk(url), base).toString();
  } catch {
    return stripTrailingUrlJunk(url);
  }
}

function isModLike(nameOrUrl: string) {
  const clean = nameOrUrl.split("?")[0].toLowerCase();
  return MOD_EXTENSIONS.some((ext) => clean.endsWith(ext));
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isMegaUrl(url: string) {
  const host = hostOf(url);
  return CLOUD_DOWNLOAD_HOSTS.includes(host);
}

function isCloudDownloadUrl(url: string) {
  return isMegaUrl(url);
}

async function fetchText(url: string, cookie: string | null): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 KK-Diction-Patreon-Indexer/1.0",
      "accept": "text/html,application/json;q=0.9,*/*;q=0.8",
      ...(cookie ? { cookie } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status} ${res.statusText}: ${url}`);
  }
  return await res.text();
}

async function fetchJson(url: string, cookie: string | null): Promise<any> {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 KK-Diction-Patreon-Indexer/1.0",
      "accept": "application/json, text/plain, */*",
      ...(cookie ? { cookie } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`API fetch failed ${res.status} ${res.statusText}: ${url}`);
  }
  return await res.json();
}

function extractTitleFromHtml(html: string, fallback: string) {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return og ? htmlDecode(og[1]).trim() : fallback;
}

function extractPostUrlsFromHtml(html: string) {
  const normalized = htmlDecode(html);
  const urls = new Set<string>();
  const absolute = normalized.match(/https:\/\/www\.patreon\.com\/posts\/[A-Za-z0-9._~%+\-]+/g) || [];
  for (const url of absolute) urls.add(url.split("?")[0]);
  const relative = normalized.match(/\/posts\/[A-Za-z0-9._~%+\-]+/g) || [];
  for (const url of relative) urls.add(normalizeUrl(url).split("?")[0]);
  return [...urls];
}

function extractCampaignId(html: string) {
  const normalized = htmlDecode(html);
  const patterns = [
    /"campaign_id"\s*:\s*"?(\d+)"?/,
    /"campaign"\s*:\s*\{[^{}]*"id"\s*:\s*"?(\d+)"?/,
    /campaigns\/(\d+)/,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function candidateNameFromUrl(url: string, fallback: string) {
  try {
    const parsed = new URL(url);
    const leaf = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || "");
    return leaf && leaf.length < 160 ? leaf : fallback;
  } catch {
    return fallback;
  }
}

function extractMegaLinks(text: string, contextName: string, source: AttachmentSource): AttachmentCandidate[] {
  const normalized = htmlDecode(text);
  const candidates = new Map<string, AttachmentCandidate>();
  const urlMatches = normalized.match(/https?:\/\/(?:mega\.nz|mega\.co\.nz)\/[^\s"'<>]+/gi) || [];
  for (const rawUrl of urlMatches) {
    const url = normalizeUrl(rawUrl);
    if (!isMegaUrl(url)) continue;
    const name = `${contextName} - MEGA`;
    candidates.set(url, {
      name,
      url,
      downloadUrl: url,
      source,
      host: hostOf(url),
      kind: "cloud-link",
    });
  }
  return [...candidates.values()];
}

function extractGenericExternalLinks(text: string, contextName: string, source: AttachmentSource): AttachmentCandidate[] {
  const normalized = htmlDecode(text);
  const candidates = new Map<string, AttachmentCandidate>();
  const urlMatches = normalized.match(/https?:\/\/[^"'<>\s]+/g) || [];
  for (const rawUrl of urlMatches) {
    const url = normalizeUrl(rawUrl);
    const host = hostOf(url);
    if (!host) continue;
    if (host.includes("patreon.com") || host.includes("patreonusercontent.com")) continue;
    if (!isCloudDownloadUrl(url) && !isModLike(url)) continue;
    const name = isMegaUrl(url) ? `${contextName} - MEGA` : candidateNameFromUrl(url, `${contextName} - external download`);
    candidates.set(url, {
      name,
      url,
      downloadUrl: url,
      source,
      host,
      kind: isCloudDownloadUrl(url) ? "cloud-link" : isModLike(url) ? "mod-file" : "external-link",
    });
  }
  return [...candidates.values()];
}

function extractPatreonFileAttachments(html: string): AttachmentCandidate[] {
  const normalized = htmlDecode(html);
  const candidates = new Map<string, AttachmentCandidate>();
  const urlMatches = normalized.match(/https?:\/\/[^"'<>\s]+/g) || [];
  for (const rawUrl of urlMatches) {
    const url = normalizeUrl(rawUrl.replace(/\\/g, ""));
    if (!/patreonusercontent\.com|patreon\.com\/file/i.test(url)) continue;
    const guessedName = candidateNameFromUrl(url, "patreon-file");
    if (!isModLike(guessedName) && !isModLike(url)) continue;
    candidates.set(url, { name: guessedName, url, downloadUrl: url, source: "html", host: hostOf(url), kind: "mod-file" });
  }
  return [...candidates.values()];
}

function extractHtmlAttachments(html: string, contextName: string): AttachmentCandidate[] {
  return uniqueAttachments([
    ...extractPatreonFileAttachments(html),
    ...extractGenericExternalLinks(html, contextName, "html"),
  ]);
}

function attachmentFromApiObject(item: any): AttachmentCandidate | null {
  const attrs = item?.attributes ?? item ?? {};
  const name = String(attrs.name ?? attrs.file_name ?? attrs.filename ?? attrs.title ?? item?.id ?? "attachment");
  const url = attrs.url ?? attrs.download_url ?? attrs.downloadUrl ?? attrs.file_url ?? attrs.upload_url;
  const downloadUrl = attrs.download_url ?? attrs.downloadUrl ?? attrs.url ?? attrs.file_url;
  const sizeBytes = Number(attrs.size_bytes ?? attrs.size ?? attrs.file_size ?? 0) || undefined;
  const urlText = typeof url === "string" ? url : "";
  const downloadText = typeof downloadUrl === "string" ? downloadUrl : "";
  if (!isModLike(name) && !isModLike(urlText) && !isModLike(downloadText) && !isCloudDownloadUrl(urlText) && !isCloudDownloadUrl(downloadText)) {
    return null;
  }
  const finalUrl = downloadText || urlText;
  return {
    id: item?.id ? String(item.id) : undefined,
    name,
    url: urlText || undefined,
    downloadUrl: downloadText || undefined,
    sizeBytes,
    source: "api",
    host: finalUrl ? hostOf(finalUrl) : undefined,
    kind: isCloudDownloadUrl(finalUrl) ? "cloud-link" : "mod-file",
  };
}

function extractContentDownloads(attrs: any, title: string): AttachmentCandidate[] {
  const chunks = [
    attrs.content,
    attrs.teaser_text,
    attrs.post_metadata ? JSON.stringify(attrs.post_metadata) : "",
    attrs.embed ? JSON.stringify(attrs.embed) : "",
  ].filter((value) => typeof value === "string" && value.length > 0);
  return uniqueAttachments(chunks.flatMap((chunk) => extractGenericExternalLinks(chunk, title, "content")));
}

function postFromApiObject(item: any, includedById: Map<string, any>, sourceUrl: string): PostCandidate {
  const attrs = item.attributes ?? {};
  const title = String(attrs.title ?? attrs.post_title ?? item.id ?? "Untitled Patreon post");
  const url = normalizeUrl(String(attrs.url ?? attrs.post_url ?? `/posts/${item.id}`), sourceUrl);
  const relationships = item.relationships ?? {};
  const attachmentRefs = relationships.attachments?.data ?? relationships.media?.data ?? [];
  const attachments: AttachmentCandidate[] = [];
  for (const ref of attachmentRefs) {
    const key = `${ref.type}:${ref.id}`;
    const inc = includedById.get(key) ?? includedById.get(String(ref.id));
    const attachment = attachmentFromApiObject(inc);
    if (attachment) attachments.push(attachment);
  }
  if (Array.isArray(attrs.attachments)) {
    for (const raw of attrs.attachments) {
      const attachment = attachmentFromApiObject(raw);
      if (attachment) attachments.push(attachment);
    }
  }
  attachments.push(...extractContentDownloads(attrs, title));
  return {
    id: item.id ? String(item.id) : undefined,
    title,
    url,
    publishedAt: attrs.published_at ?? attrs.publishedAt ?? undefined,
    isPaid: typeof attrs.is_paid === "boolean" ? attrs.is_paid : null,
    attachments: uniqueAttachments(attachments),
  };
}

function canonicalAttachmentKey(item: AttachmentCandidate) {
  const url = normalizeUrl(item.downloadUrl ?? item.url ?? "");
  if (isMegaUrl(url)) return `mega:${url}`;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const match = parsed.pathname.match(/\/post\/(\d+)\/([^/]+)\/.+\/([^/]+)$/);
    if (host.endsWith("patreonusercontent.com") && match) {
      return `patreon-file:${match[1]}:${match[2]}:${decodeURIComponent(match[3])}`;
    }
    return `${host}:${parsed.pathname}`;
  } catch {
    return `${item.name}|${url}`;
  }
}

function uniqueAttachments(items: AttachmentCandidate[]) {
  const seen = new Set<string>();
  const out: AttachmentCandidate[] = [];
  for (const item of items) {
    const key = canonicalAttachmentKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    if (item.url) item.url = normalizeUrl(item.url);
    if (item.downloadUrl) item.downloadUrl = normalizeUrl(item.downloadUrl);
    out.push(item);
  }
  return out;
}

async function indexPostUrl(url: string, cookie: string | null): Promise<PostCandidate> {
  const html = await fetchText(url, cookie);
  const title = extractTitleFromHtml(html, url);
  const attachments = extractHtmlAttachments(html, title);
  const idMatch = url.match(/(?:posts\/[^/\s-]+-)?(\d+)(?:$|[/?#])/);
  return {
    id: idMatch?.[1],
    title,
    url,
    isPaid: null,
    attachments: uniqueAttachments(attachments),
  };
}

async function enrichPostsFromHtml(posts: PostCandidate[], cookie: string | null, warnings: string[], offset = 0, limit = posts.length) {
  const end = Math.min(posts.length, offset + limit);
  for (let i = offset; i < end; i++) {
    const post = posts[i];
    try {
      const html = await fetchText(post.url, cookie);
      const htmlAttachments = extractHtmlAttachments(html, post.title);
      post.attachments = uniqueAttachments([...post.attachments, ...htmlAttachments]);
    } catch (error) {
      warnings.push(`Deep HTML scan failed for ${post.url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function indexCreatorByApi(sourceUrl: string, campaignId: string, cookie: string | null, maxPages: number): Promise<PostCandidate[]> {
  const posts: PostCandidate[] = [];
  let nextUrl = new URL("https://www.patreon.com/api/posts");
  nextUrl.searchParams.set("filter[campaign_id]", campaignId);
  nextUrl.searchParams.set("sort", "-published_at");
  nextUrl.searchParams.set("page[count]", "50");
  nextUrl.searchParams.set("include", "attachments,campaign,user");
  nextUrl.searchParams.set("fields[post]", "title,url,published_at,is_paid,post_type,content,teaser_text,post_metadata,embed");
  nextUrl.searchParams.set("fields[attachment]", "name,url,download_url,size_bytes,metadata");

  for (let page = 0; page < maxPages && nextUrl; page++) {
    const json = await fetchJson(nextUrl.toString(), cookie);
    const includedById = new Map<string, any>();
    for (const inc of json.included ?? []) {
      if (inc?.id) {
        includedById.set(`${inc.type}:${inc.id}`, inc);
        includedById.set(String(inc.id), inc);
      }
    }
    for (const item of json.data ?? []) {
      const post = postFromApiObject(item, includedById, sourceUrl);
      if (post.attachments.length > 0 || post.title) posts.push(post);
    }
    nextUrl = json.links?.next ? new URL(json.links.next) : null;
  }
  return posts;
}

function summarizePosts(posts: PostCandidate[]) {
  const all = posts.flatMap((post) => post.attachments);
  const modAttachmentCount = all.filter((attachment) => isModLike(attachment.name) || isModLike(attachment.downloadUrl ?? attachment.url ?? "")).length;
  const cloudDownloadCount = all.filter((attachment) => attachment.kind === "cloud-link" || isCloudDownloadUrl(attachment.downloadUrl ?? attachment.url ?? "")).length;
  const megaLinkCount = all.filter((attachment) => isMegaUrl(attachment.downloadUrl ?? attachment.url ?? "")).length;
  return {
    postCount: posts.length,
    postsWithDownloads: posts.filter((post) => post.attachments.length > 0).length,
    postsWithModFiles: posts.filter((post) => post.attachments.some((attachment) => isModLike(attachment.name) || isModLike(attachment.downloadUrl ?? attachment.url ?? ""))).length,
    attachmentCount: all.length,
    modAttachmentCount,
    cloudDownloadCount,
    megaLinkCount,
  };
}

async function main() {
  loadLocalEnv();
  const args = parseArgs(process.argv.slice(2));
  if (args.has("help") || args.has("h")) {
    printHelp();
    return;
  }

  const sourceUrl = String(args.get("url") ?? "").trim();
  if (!sourceUrl) {
    printHelp();
    throw new Error("Missing required --url");
  }

  const maxPages = Math.max(1, Number(args.get("max-pages") ?? 3) || 3);
  const deepHtml = args.has("deep-html") || args.has("deep");
  const deepOffset = Math.max(0, Number(args.get("deep-offset") ?? 0) || 0);
  const deepLimit = Math.max(1, Number(args.get("deep-limit") ?? 50) || 50);
  const authorSlug = slugify(String(args.get("author") ?? new URL(sourceUrl).pathname.split("/").filter(Boolean)[0] ?? "patreon-author"));
  const requestedOutPath = args.get("out");
  const outPath = requestedOutPath
    ? resolveWorkflowPath(String(requestedOutPath))
    : path.join(dbModsRoot, "source", authorSlug, "index.patreon.json");
  const { cookie, variable } = getPatreonCookie();
  const warnings: string[] = [];
  if (!cookie) warnings.push("No Patreon cookie/session env variable found. Public posts may still index, but locked/free-account-visible attachments may be missing.");
  if (variable === "PATREON_sessoinid") warnings.push("Using legacy typo env variable PATREON_sessoinid. Rename to PATREON_SESSION_ID when convenient.");

  const html = await fetchText(sourceUrl, cookie);
  let posts: PostCandidate[] = [];

  if (/\/posts\//.test(sourceUrl)) {
    posts = [await indexPostUrl(sourceUrl, cookie)];
  } else {
    const campaignId = extractCampaignId(html);
    if (campaignId) {
      try {
        posts = await indexCreatorByApi(sourceUrl, campaignId, cookie, maxPages);
      } catch (error) {
        warnings.push(`Patreon API indexing failed; falling back to visible post links. ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      warnings.push("Could not find campaign id in creator page; falling back to visible post links only.");
    }

    if (posts.length === 0) {
      const urls = extractPostUrlsFromHtml(html).slice(0, 50 * maxPages);
      if (urls.length === 0) warnings.push("No post URLs found in the creator page HTML. The page may require a browser-rendered export.");
      for (const postUrl of urls) {
        try {
          posts.push(await indexPostUrl(postUrl, cookie));
        } catch (error) {
          warnings.push(`Failed to index ${postUrl}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } else if (deepHtml) {
      await enrichPostsFromHtml(posts, cookie, warnings, deepOffset, deepLimit);
    }
  }

  const output: IndexOutput = {
    generatedAt: new Date().toISOString(),
    sourceUrl,
    authorSlug,
    mode: "index-only",
    env: {
      hasCookie: Boolean(cookie),
      cookieVariable: variable,
    },
    summary: summarizePosts(posts),
    warnings,
    posts,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

  console.log(JSON.stringify({
    outPath,
    authorSlug,
    cookieLoaded: Boolean(cookie),
    cookieVariable: variable,
    summary: output.summary,
    warnings,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
