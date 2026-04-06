import { buildContentFileDownloadPath, buildLegacyContentFileDownloadPath } from "@/lib/downloads/content-file-token";
import { buildR2PublicUrl } from "@/lib/storage/r2";

export function getPrimaryTagName(
  content: {
    title: string;
    contentTags: Array<{
      tag: {
        name: string;
        type: string;
      };
    }>;
  },
  type: "AUTHOR" | "WORK" | "CHARACTER" | "TYPE"
) {
  return content.contentTags.find((item) => item.tag.type === type)?.tag.name?.trim();
}

export function normalizeTypeLabel(raw?: string) {
  if (!raw) {
    return "Content";
  }

  const compact = raw.trim();
  if (!compact) {
    return "Content";
  }

  return compact
    .split(/[\s-_]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function isTelegramUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "t.me" || parsed.hostname === "telegram.me" || parsed.hostname.endsWith(".t.me");
  } catch {
    return false;
  }
}

export function normalizeContentDownloadEntries(content: {
  downloadLinks: Array<{ url: string }>;
  hostedFiles: Array<{ id: number; objectKey: string; fileName: string }>;
}) {
  const hostedFileByPublicUrl = new Map(content.hostedFiles.map((file) => [buildR2PublicUrl(file.objectKey), file]));
  const hostedFileByLegacyPath = new Map(
    content.hostedFiles.map((file) => [buildLegacyContentFileDownloadPath(file.id), file])
  );
  const hostedFileByTokenPath = new Map(
    content.hostedFiles.map((file) => [buildContentFileDownloadPath(file.id), file])
  );

  const normalizedDownloadEntries = content.downloadLinks.map((link) => {
    const hostedFile =
      hostedFileByPublicUrl.get(link.url) ?? hostedFileByLegacyPath.get(link.url) ?? hostedFileByTokenPath.get(link.url);

    if (hostedFile) {
      return {
        kind: "website" as const,
        url: buildContentFileDownloadPath(hostedFile.id),
        label: hostedFile.fileName
      };
    }

    return {
      kind: isTelegramUrl(link.url) ? ("telegram" as const) : ("other" as const),
      url: link.url,
      label: link.url
    };
  });

  const tgDownloadLink = normalizedDownloadEntries.find((entry) => entry.kind === "telegram")?.url;
  const siteDownloadEntries = [
    ...new Map(
      normalizedDownloadEntries
        .filter((entry) => entry.kind === "website")
        .map((entry) => [entry.url, entry] as const)
    ).values()
  ];

  if (!siteDownloadEntries.length && content.hostedFiles.length) {
    siteDownloadEntries.push(
      ...content.hostedFiles.map((file) => ({
        kind: "website" as const,
        url: buildContentFileDownloadPath(file.id),
        label: file.fileName
      }))
    );
  }

  return {
    tgDownloadLink,
    siteDownloadEntries
  };
}
