import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentDetailView } from "@/components/content-detail-view";
import { getBrowsableContentBySlug, getBrowsableContentMetadataBySlug } from "@/lib/content";
import { getPrimaryTagName, normalizeContentDownloadEntries, normalizeTypeLabel } from "@/lib/content-detail";

export const preferredRegion = "hkg1";
export const dynamic = "force-static";
export const revalidate = 900;

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const content = await getBrowsableContentMetadataBySlug(slug);

  if (!content) {
    return {
      title: "Content Not Found | Koikatsu Card Archive"
    };
  }

  const work = getPrimaryTagName(content, "WORK");
  const character = getPrimaryTagName(content, "CHARACTER");
  const author = getPrimaryTagName(content, "AUTHOR");
  const type = normalizeTypeLabel(getPrimaryTagName(content, "TYPE"));
  const normalizedCharacter = character?.toLowerCase();
  const useCharacter =
    normalizedCharacter && normalizedCharacter !== "unknown character" && normalizedCharacter !== "unknown";

  const titleParts = [
    useCharacter ? character : content.title,
    work,
    `Koikatsu ${type}`
  ].filter(Boolean);

  const descriptionSource = work ?? author ?? "the Koikatsu archive";

  return {
    title: titleParts.join(" | "),
    description: `View ${content.title} from ${descriptionSource} in the Koikatsu archive, with preview images, structured tags, original source details, and available download options.`
  };
}

export default async function ContentDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const content = await getBrowsableContentBySlug(slug, false);

  if (!content) {
    notFound();
  }

  const { tgDownloadLink, siteDownloadEntries, apexDriveEntries } = normalizeContentDownloadEntries(content);

  return (
    <ContentDetailView
      content={content}
      tgDownloadLink={tgDownloadLink}
      siteDownloadEntries={siteDownloadEntries}
      apexDriveEntries={apexDriveEntries}
      locale="en"
      copy={{
        unverifiedTitle: "Unverified Content",
        unverifiedBody: "This post has not been fully reviewed yet. Tags and metadata may still be incomplete or inaccurate.",
        visibleContentEyebrow: "Visible Content",
        edit: "Edit",
        originalSource: "Original Source",
        downloadLinks: "Download Links",
        telegramDownload: "TG Download",
        websiteDownload: "Website Download",
        websiteDownloads: (count) => `Website Download (${count})`,
        apexDriveDownload: "ApexDrive Download",
        apexDriveDownloads: (count) => `ApexDrive Download (${count})`,
        websiteDownloadLoginRequired: "Website Download is available for logged-in members only.",
        login: "Login",
        adBlockNotice: {
          title: "Ad blocker detected",
          body: "Please disable your ad blocker or add this site to allowlist. Ads help keep downloads and updates running.",
          action: "I disabled it",
          close: "Close"
        },
        type: "Type",
        author: "Author",
        work: "Work",
        character: "Character",
        style: "Style",
        usage: "Usage",
        reviewStatus: {
          edited: "Edited",
          passed: "Passed",
          unverified: "Unverified"
        }
      }}
    />
  );
}
