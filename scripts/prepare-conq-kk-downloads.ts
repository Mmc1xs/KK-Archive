import fs from "node:fs";
import path from "node:path";
import { dbModsRoot, workflowRoot } from "./workflow-paths";

const INDEX_PATH = path.join(dbModsRoot, "source", "conq", "index.patreon.deep-merged.json");
const OUT_ROOT = path.join(dbModsRoot, "source", "conq");
const PLAN_PATH = path.join(OUT_ROOT, "conq-kk-download-plan.json");
const REVIEW_PATH = path.join(OUT_ROOT, "conq-kk-download-review.md");

function slugify(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 90) || "post";
}

function hostOf(url: string) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ""; }
}

function isMega(item: any) {
  const host = hostOf(item.url || item.downloadUrl || "");
  return host.includes("mega.nz") || host.includes("mega.co.nz");
}

function isPatreonNative(item: any) {
  const host = hostOf(item.url || item.downloadUrl || "");
  return host.includes("patreonusercontent.com") || host.includes("patreon.com");
}

function cleanMegaUrl(url: string) {
  return String(url || "").replace(/\\+$/g, "").replace(/[\]'"),;]+$/g, "").trim();
}

function downloadUrl(item: any) {
  return cleanMegaUrl(item.downloadUrl || item.url || "");
}

function isKkRelated(title: string) {
  const t = title.toLowerCase();
  if (/\bkk\b/i.test(title)) return true;
  if (t.includes("ai/hs/hs2/kk")) return true;
  return false;
}

function isExcludedNonKk(title: string) {
  const t = title.toLowerCase();
  // Exclude explicit non-KK-only categories when they do not also contain KK.
  if (isKkRelated(title)) return false;
  if (/^rg\b/.test(t) || t.includes("rg character")) return true;
  if (/^hs\b/.test(t) || t.includes("hs scene") || t.includes("hs character")) return true;
  if (t.includes("ai/hs2") && !t.includes("/kk")) return true;
  if (/^ai\b/.test(t) && !t.includes("/kk")) return true;
  if (t.includes("hs2") && !t.includes("/kk")) return true;
  return true;
}

function dedupeItems(items: any[]) {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const item of items || []) {
    const url = downloadUrl(item);
    if (!url) continue;
    const key = `${item.kind || ""}|${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...item, url, downloadUrl: url });
  }
  return out;
}

function ensureDir(p: string) { fs.mkdirSync(p, { recursive: true }); }

const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
const selectedPosts: any[] = [];
const excludedPosts: any[] = [];

for (const post of index.posts || []) {
  const title = String(post.title || "");
  const downloads = dedupeItems(post.attachments || post.downloads || []);
  if (downloads.length === 0) continue;
  if (isKkRelated(title) && !isExcludedNonKk(title)) {
    const folderName = `${post.id || "noid"}-${slugify(title)}`;
    const patreonNative = downloads.filter(isPatreonNative);
    const mega = downloads.filter(isMega);
    const other = downloads.filter((item) => !isPatreonNative(item) && !isMega(item));
    selectedPosts.push({
      id: post.id,
      title,
      url: post.url,
      publishedAt: post.publishedAt,
      folderName,
      targetFolders: {
        patreon: path.relative(workflowRoot, path.join(OUT_ROOT, "raw", "patreon", folderName)),
        mega: path.relative(workflowRoot, path.join(OUT_ROOT, "raw", "mega", folderName)),
      },
      downloads: { patreonNative, mega, other },
    });
  } else {
    excludedPosts.push({ id: post.id, title, url: post.url, reason: "not KK-related or explicit non-KK-only", downloadCount: downloads.length });
  }
}

const summary = {
  source: INDEX_PATH,
  selectedPostCount: selectedPosts.length,
  excludedPostCount: excludedPosts.length,
  patreonNativeCount: selectedPosts.reduce((sum, p) => sum + p.downloads.patreonNative.length, 0),
  megaCount: selectedPosts.reduce((sum, p) => sum + p.downloads.mega.length, 0),
  otherCount: selectedPosts.reduce((sum, p) => sum + p.downloads.other.length, 0),
};

ensureDir(OUT_ROOT);
fs.writeFileSync(PLAN_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), summary, selectedPosts, excludedPosts }, null, 2), "utf8");

const lines: string[] = [];
lines.push("# ConQ KK Download Review");
lines.push("");
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push("");
lines.push("## Summary");
lines.push("");
lines.push(`- Selected KK-related posts: ${summary.selectedPostCount}`);
lines.push(`- Excluded non-KK posts: ${summary.excludedPostCount}`);
lines.push(`- Patreon native downloads: ${summary.patreonNativeCount}`);
lines.push(`- MEGA links: ${summary.megaCount}`);
lines.push(`- Other links: ${summary.otherCount}`);
lines.push("");
lines.push("## Selected posts");
lines.push("");
for (const post of selectedPosts) {
  lines.push(`### ${post.title}`);
  lines.push("");
  lines.push(`- Post: ${post.url}`);
  lines.push(`- Folder: ${post.folderName}`);
  lines.push(`- Patreon native: ${post.downloads.patreonNative.length}`);
  lines.push(`- MEGA: ${post.downloads.mega.length}`);
  lines.push(`- Other: ${post.downloads.other.length}`);
  lines.push("");
}
lines.push("## Excluded posts with downloads");
lines.push("");
for (const post of excludedPosts) {
  lines.push(`- ${post.title} (${post.downloadCount}) - ${post.url}`);
}
fs.writeFileSync(REVIEW_PATH, lines.join("\n"), "utf8");

console.log(JSON.stringify({
  planPath: path.relative(workflowRoot, PLAN_PATH),
  reviewPath: path.relative(workflowRoot, REVIEW_PATH),
  summary
}, null, 2));
