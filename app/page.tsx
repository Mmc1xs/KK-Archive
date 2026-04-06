import type { Metadata } from "next";
import { HomePageView } from "@/components/home-page-view";
import {
  getHomepageHotTopicContents,
  getHomepageLatestPublishedContents,
  getHomepageOverviewStats
} from "@/lib/content";

export const revalidate = 300;
export const preferredRegion = "hkg1";

export const metadata: Metadata = {
  title: "Koikatsu Card Archive | Presets, Scenes, Textures and Shared Files",
  description:
    "Browse a structured Koikatsu archive for character cards, presets, scenes, textures, overlays, and shared files with tag-based filtering."
};

const copy = {
  heroEyebrow: "KK File Index",
  heroScreenReaderTitle: "Find KK-related files through clean tag browsing.",
  featurePills: ["Character cards", "Scene presets", "Textures & overlays"] as [string, string, string],
  searchArchiveLabel: "Search Archive",
  browseFilesLabel: "Browse Files",
  briefingEyebrow: "Academy Briefing",
  archiveOverviewLabel: "Archive Overview",
  onlineLabel: "Online",
  totalPostsEyebrow: "Total Posts",
  totalPostsDescription: "Published entries currently available in the archive",
  indexedAuthorsEyebrow: "Indexed Authors",
  indexedAuthorsDescription: "Author tags currently available for structured browsing",
  spotlightEyebrow: "Spotlight Entry",
  spotlightFallbackTitle: "Latest archive entry",
  spotlightFallbackAuthor: "KK Archive",
  roadmapEyebrow: "Future Roadmap",
  roadmapItems: [
    {
      title: "Mod Library",
      description: "Add a dedicated mod library to support and extend the core card library workflow."
    },
    {
      title: "Post Likes",
      description: "Add post likes so members can quickly signal useful content."
    }
  ],
  reservedEyebrow: "Reserved Panel",
  reservedLabel: "Future Slot",
  hotTopicEyebrow: "Hot Topic",
  hotTopicTitle: "Hot Topic",
  latestPublishedEyebrow: "Latest Published",
  latestPublishedTitle: "Latest Published Content",
  viewMoreLabel: "View More"
};

export default async function HomePage() {
  const [hotTopicContents, latestPublishedContents, overviewStats] = await Promise.all([
    getHomepageHotTopicContents(),
    getHomepageLatestPublishedContents(),
    getHomepageOverviewStats()
  ]);

  return (
    <HomePageView
      hotTopicContents={hotTopicContents}
      latestPublishedContents={latestPublishedContents}
      overviewStats={overviewStats}
      copy={copy}
      locale="en"
    />
  );
}
