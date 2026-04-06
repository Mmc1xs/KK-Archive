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
  title: "KK Archive | 中文首页",
  description: "用结构化标签浏览 KK Archive，探索角色卡、场景、贴图与共享文件。"
};

const copy = {
  heroEyebrow: "KK 文件索引",
  heroScreenReaderTitle: "通过清晰的标签浏览 KK 相关文件。",
  featurePills: ["角色卡", "场景预设", "贴图与覆盖层"] as [string, string, string],
  searchArchiveLabel: "搜索档案库",
  browseFilesLabel: "浏览文件",
  briefingEyebrow: "档案简报",
  archiveOverviewLabel: "档案概览",
  onlineLabel: "在线",
  totalPostsEyebrow: "总帖子数",
  totalPostsDescription: "当前可浏览的公开内容数量",
  indexedAuthorsEyebrow: "作者标签数",
  indexedAuthorsDescription: "当前可用于结构化浏览的作者标签数量",
  spotlightEyebrow: "焦点条目",
  spotlightFallbackTitle: "最新档案条目",
  spotlightFallbackAuthor: "KK Archive",
  roadmapEyebrow: "后续规划",
  roadmapItems: [
    {
      title: "Mod 资料库",
      description: "新增独立的 Mod 资料区，补强核心卡片资料库流程。"
    },
    {
      title: "帖子点赞",
      description: "加入帖子点赞功能，让成员能更快标记有帮助的内容。"
    }
  ],
  reservedEyebrow: "预留面板",
  reservedLabel: "后续预留位",
  hotTopicEyebrow: "热门主题",
  hotTopicTitle: "热门主题",
  latestPublishedEyebrow: "最新发布",
  latestPublishedTitle: "最新发布内容",
  viewMoreLabel: "查看更多"
};

export default async function HomePageZhCn() {
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
      locale="zh-CN"
    />
  );
}
