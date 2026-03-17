import "./load-env";
import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { spawnSync } from "child_process";
import { db } from "../lib/db";

type CleanImportCandidate = {
  folder: string;
  anchorMessageId: number;
  pixivArtworkUrl: string | null;
  pixivArtworkId: string | null;
  imagePaths: string[];
  coverImagePath: string | null;
  rawText: string;
  sourceMetaPath: string;
};

type PixivIllustResponse = {
  error: boolean;
  message: string;
  body: {
    illustTitle: string;
    userName: string;
  };
};

type PixivPagesResponse = {
  error: boolean;
  message: string;
  body: Array<{
    urls: {
      original: string;
    };
  }>;
};

type EnrichedCleanImportCandidate = CleanImportCandidate & {
  pixivTitle: string | null;
  pixivAuthorName: string | null;
  pixivImageUrls: string[];
  pixivFetchError: string | null;
};

const manifestPath = path.resolve(process.cwd(), "scripts", "clean-import-manifest.json");
const outPath = path.resolve(process.cwd(), "scripts", "clean-import-manifest.enriched.json");

function rebuildBaseManifest() {
  const result = spawnSync("npx", ["tsx", "scripts/build-clean-import-manifest.ts"], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "Failed to rebuild clean manifest").trim());
  }
}

function getPixivHeaders(includeCookie: boolean) {
  const cookie = process.env.PIXIV_COOKIE?.trim();
  return {
    Referer: "https://www.pixiv.net/",
    "User-Agent": "Mozilla/5.0",
    ...(includeCookie && cookie ? { Cookie: cookie } : {})
  };
}

async function fetchPixivJson<T>(url: string, includeCookie: boolean) {
  const response = await fetch(url, {
    headers: getPixivHeaders(includeCookie)
  });

  if (!response.ok) {
    throw new Error(`Pixiv request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

async function fetchPixivJsonWithRetry<T>(url: string, attempts = 3): Promise<T> {
  let lastError: unknown;
  const cookie = process.env.PIXIV_COOKIE?.trim();
  const strategies = cookie ? [true, false] : [false];

  for (const includeCookie of strategies) {
    for (let index = 0; index < attempts; index += 1) {
      try {
        return await fetchPixivJson<T>(url, includeCookie);
      } catch (error) {
        lastError = error;
        if (index < attempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 800 * (index + 1)));
        }
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown fetch error");
}

async function enrichCandidate(candidate: CleanImportCandidate): Promise<EnrichedCleanImportCandidate> {
  if (!candidate.pixivArtworkId) {
    return {
      ...candidate,
      pixivTitle: null,
      pixivAuthorName: null,
      pixivImageUrls: [],
      pixivFetchError: "Missing Pixiv artwork ID"
    };
  }

  try {
    const illust = await fetchPixivJsonWithRetry<PixivIllustResponse>(`https://www.pixiv.net/ajax/illust/${candidate.pixivArtworkId}`);
    if (illust.error) {
      throw new Error(illust.message || "Unknown Pixiv illust error");
    }

    let pixivImageUrls: string[] = [];
    let pixivFetchError: string | null = null;

    try {
      const pages = await fetchPixivJsonWithRetry<PixivPagesResponse>(`https://www.pixiv.net/ajax/illust/${candidate.pixivArtworkId}/pages`);
      if (pages.error) {
        throw new Error(pages.message || "Unknown Pixiv pages error");
      }
      pixivImageUrls = (pages.body ?? []).map((page) => page.urls.original).filter(Boolean).slice(0, 3);
    } catch (error) {
      pixivFetchError = error instanceof Error ? error.message : "Unknown pages fetch error";
    }

    return {
      ...candidate,
      pixivTitle: illust.body?.illustTitle ?? null,
      pixivAuthorName: illust.body?.userName ?? null,
      pixivImageUrls,
      pixivFetchError
    };
  } catch (error) {
    return {
      ...candidate,
      pixivTitle: null,
      pixivAuthorName: null,
      pixivImageUrls: [],
      pixivFetchError: error instanceof Error ? error.message : "Unknown fetch error"
    };
  }
}

function needsEnrichment(candidate: CleanImportCandidate, existing?: EnrichedCleanImportCandidate) {
  if (!existing) {
    return true;
  }

  if (existing.pixivArtworkId !== candidate.pixivArtworkId) {
    return true;
  }

  if (existing.imagePaths.length !== candidate.imagePaths.length) {
    return true;
  }

  if (candidate.pixivArtworkId && (!existing.pixivTitle || !existing.pixivAuthorName)) {
    return true;
  }

  return false;
}

async function main() {
  rebuildBaseManifest();

  if (!existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }

  const candidates = JSON.parse(await readFile(manifestPath, "utf8")) as CleanImportCandidate[];
  const existing = existsSync(outPath)
    ? (JSON.parse(await readFile(outPath, "utf8")) as EnrichedCleanImportCandidate[])
    : [];

  const existingLinks = await db.contentDownloadLink.findMany({
    select: { url: true }
  });
  const existingLinkSet = new Set(existingLinks.map((item) => item.url));
  const pendingFolderSet = new Set(
    candidates
      .filter((candidate) => !existingLinkSet.has(`https://t.me/Koikatunews/${candidate.folder}`))
      .map((candidate) => candidate.folder)
  );

  const existingMap = new Map(existing.map((entry) => [entry.folder, entry]));
  const merged = new Map<string, EnrichedCleanImportCandidate>();

  for (const entry of existing) {
    merged.set(entry.folder, entry);
  }

  const targets = candidates.filter(
    (candidate) => pendingFolderSet.has(candidate.folder) && needsEnrichment(candidate, existingMap.get(candidate.folder))
  );

  for (const candidate of targets) {
    const next = await enrichCandidate(candidate);
    merged.set(candidate.folder, next);
    console.log(
      `[PIXIV:NEW] ${candidate.folder} -> title=${next.pixivTitle ?? "N/A"} author=${next.pixivAuthorName ?? "N/A"} images=${next.pixivImageUrls.length}`
    );
  }

  for (const candidate of candidates) {
    if (!merged.has(candidate.folder)) {
      merged.set(candidate.folder, {
        ...candidate,
        pixivTitle: null,
        pixivAuthorName: null,
        pixivImageUrls: [],
        pixivFetchError: "Missing enrichment entry"
      });
    }
  }

  const out = Array.from(merged.values()).sort((a, b) => Number(a.folder) - Number(b.folder));
  await writeFile(outPath, JSON.stringify(out, null, 2), "utf8");

  console.log(`Updated ${targets.length} folder(s) -> ${outPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
