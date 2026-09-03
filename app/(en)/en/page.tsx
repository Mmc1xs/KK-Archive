import type { Metadata } from "next";
import { HomePageView } from "@/components/home-page-view";
import {
  getHomepageBulletins,
  getHomepageHotTopicContents,
  getHomepageLatestPublishedContents,
  getHomepageOverviewStats
} from "@/lib/content";
import { getLocaleInstallVersionHref } from "@/lib/ui-locale";

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
  telegramGroupEyebrow: "Community Hub",
  telegramGroupTitle: "Join KK Archive on Telegram",
  telegramGroupDescription: "Get updates, file-share notices, and issue-report help from the group.",
  telegramGroupActionLabel: "Open Group",
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
  downloadPanelEyebrow: "Clean Source",
  downloadPanelTitle: "Base Game Downloads",
  downloadPanelDescription: "Pick the matching base package first, then pair it with cards, scenes, and mod resources from the archive.",
  downloadCards: [
    {
      code: "KK",
      title: "Koikatsu Party",
      description: "School-setting base source for most KK cards and legacy resources.",
      href: getLocaleInstallVersionHref("en", "kk"),
      iconUrl: "https://cdn2.steamgriddb.com/grid/eacac8618eb5b3240debd191db819910.jpg",
      actionLabel: "View Setup",
      disabledLabel: "Pending"
    },
    {
      code: "KKS",
      title: "Koikatsu Sunshine",
      description: "Sunshine edition source slot reserved for the matching cloud folder.",
      href: getLocaleInstallVersionHref("en", "kks"),
      iconUrl: "https://cdn2.steamgriddb.com/grid/fdbfb9f7a6e4aa57039a56775046451b.png",
      actionLabel: "View Setup",
      disabledLabel: "Pending"
    }
  ],
  hotTopicEyebrow: "Hot Topic",
  hotTopicTitle: "Hot Topic",
  latestPublishedEyebrow: "Latest Published",
  latestPublishedTitle: "Latest Published Content",
  viewMoreLabel: "View More"
};

export default async function HomePageEn() {
  const [hotTopicContents, latestPublishedContents, bulletins, overviewStats] = await Promise.all([
    getHomepageHotTopicContents(),
    getHomepageLatestPublishedContents(),
    getHomepageBulletins("en"),
    getHomepageOverviewStats()
  ]);

  return (
    <HomePageView
      hotTopicContents={hotTopicContents}
      latestPublishedContents={latestPublishedContents}
      bulletins={bulletins}
      overviewStats={overviewStats}
      copy={copy}
      locale="en"
    />
  );
}
