import "./load-env";
import "./load-env";
import path from "path";
import { promises as fs } from "fs";

function parseArgs() {
  const args = process.argv.slice(2);
  let artworkId = "";
  let folder = "";

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--artwork-id") {
      artworkId = args[++i] ?? "";
    } else if (args[i] === "--folder") {
      folder = args[++i] ?? "";
    } else {
      throw new Error(`Unsupported argument: ${args[i]}`);
    }
  }

  if (!/^\d+$/.test(artworkId)) throw new Error("--artwork-id must be numeric");
  if (!folder.trim()) throw new Error("--folder is required");
  return { artworkId, folder: folder.trim() };
}

function assertSafeFolder(folder: string) {
  const cutRoot = path.resolve(process.cwd(), "db image", "cut");
  const target = path.resolve(cutRoot, folder);
  const relative = path.relative(cutRoot, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Unsafe cut folder: ${folder}`);
  }
  return target;
}

async function main() {
  const { artworkId, folder } = parseArgs();
  const outputFolder = assertSafeFolder(folder);
  await fs.mkdir(outputFolder, { recursive: true });

  const cookie = process.env.PIXIV_COOKIE?.trim();
  const headers = {
    Referer: "https://www.pixiv.net/",
    "User-Agent": "Mozilla/5.0",
    ...(cookie ? { Cookie: cookie } : {})
  };

  const metadataResponse = await fetch(`https://www.pixiv.net/ajax/illust/${artworkId}`, { headers });
  if (!metadataResponse.ok) throw new Error(`Pixiv metadata request failed: ${metadataResponse.status}`);
  const metadataJson = (await metadataResponse.json()) as {
    error?: boolean;
    message?: string;
    body?: {
      illustTitle?: string;
      userName?: string;
      userId?: string;
      description?: string;
      tags?: { tags?: Array<{ tag?: string }> };
    };
  };
  if (metadataJson.error || !metadataJson.body) {
    throw new Error(`Pixiv metadata response error: ${metadataJson.message || "unknown"}`);
  }
  const metadata = {
    title: metadataJson.body.illustTitle?.trim() || null,
    author: metadataJson.body.userName?.trim() || null,
    userId: metadataJson.body.userId || null,
    description: metadataJson.body.description || null,
    tags: (metadataJson.body.tags?.tags ?? []).map((item) => item.tag).filter(Boolean)
  };
  await fs.writeFile(
    path.join(outputFolder, "_pixiv-metadata.json"),
    JSON.stringify({ artworkId, sourceLink: `https://www.pixiv.net/artworks/${artworkId}`, metadata }, null, 2),
    "utf8"
  );

  const pagesResponse = await fetch(`https://www.pixiv.net/ajax/illust/${artworkId}/pages`, { headers });
  if (!pagesResponse.ok) throw new Error(`Pixiv pages request failed: ${pagesResponse.status}`);
  const pagesJson = (await pagesResponse.json()) as {
    error?: boolean;
    message?: string;
    body?: Array<{ urls?: { regular?: string; original?: string } }>;
  };
  if (pagesJson.error || !Array.isArray(pagesJson.body)) {
    throw new Error(`Pixiv pages response error: ${pagesJson.message || "unknown"}`);
  }

  const results = [];
  for (let index = 0; index < pagesJson.body.length; index += 1) {
    const url = pagesJson.body[index]?.urls?.regular || pagesJson.body[index]?.urls?.original;
    if (!url) throw new Error(`Missing image URL for page ${index}`);
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Pixiv image request failed for page ${index}: ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    const extension = contentType.includes("png") ? ".png" : contentType.includes("webp") ? ".webp" : ".jpg";
    const fileName = `${artworkId}_p${index}_regular${extension}`;
    const body = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(path.join(outputFolder, fileName), body);
    results.push({ index, fileName, bytes: body.byteLength, url });
  }

  const report = {
    artworkId,
    sourceLink: `https://www.pixiv.net/artworks/${artworkId}`,
    folder,
    outputFolder,
    metadata,
    pageCount: results.length,
    results
  };
  await fs.writeFile(path.join(outputFolder, "_pixiv-pages.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
