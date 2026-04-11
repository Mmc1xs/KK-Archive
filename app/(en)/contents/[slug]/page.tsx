import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentDetailView } from "@/components/content-detail-view";
import { getCurrentSession } from "@/lib/auth/session";
import { getBrowsableContentBySlug, getBrowsableContentMetadataBySlug, recordContentView } from "@/lib/content";
import { getPrimaryTagName, normalizeContentDownloadEntries, normalizeTypeLabel } from "@/lib/content-detail";

export const preferredRegion = "hkg1";

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
  const user = await getCurrentSession({ touchActivity: false });
  const content = await getBrowsableContentBySlug(slug, Boolean(user));

  if (!content) {
    notFound();
  }

  void recordContentView(content.id).catch(() => {
    // Non-blocking analytics: view tracking failures should not block page rendering.
  });

  const { tgDownloadLink, siteDownloadEntries } = normalizeContentDownloadEntries(content);

  return (
    <ContentDetailView
      content={content}
      user={user}
      tgDownloadLink={tgDownloadLink}
      siteDownloadEntries={siteDownloadEntries}
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
