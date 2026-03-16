import "./load-env";
import { readFile, writeFile } from "fs/promises";
import path from "path";

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

async function main() {
  const raw = await readFile(manifestPath, "utf8");
  const candidates = JSON.parse(raw) as CleanImportCandidate[];
  const enriched: EnrichedCleanImportCandidate[] = [];

  for (const candidate of candidates) {
    const next = await enrichCandidate(candidate);
    enriched.push(next);
    console.log(
      `[PIXIV] ${candidate.folder} -> title=${next.pixivTitle ?? "N/A"} author=${next.pixivAuthorName ?? "N/A"} images=${next.pixivImageUrls.length}`
    );
  }

  await writeFile(outPath, JSON.stringify(enriched, null, 2), "utf8");
  console.log(`Wrote enriched manifest -> ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
