import type { Metadata } from "next";
import { HomePageBulletinDemoView } from "@/components/home-page-bulletin-demo-view";
import {
  getHomepageHotTopicContents,
  getHomepageLatestPublishedContents,
  getHomepageOverviewStats
} from "@/lib/content";

export const revalidate = 300;
export const preferredRegion = "hkg1";

export const metadata: Metadata = {
  title: "KK Archive | Demo Bulletin Layout",
  description: "Demo page for bulletin module layout replacement on the left hero panel."
};

const copy = {
  heroScreenReaderTitle: "KK 首页布局 Demo（左侧改为公告栏）",
  bulletinEyebrow: "模拟公布栏",
  bulletinTitle: "网站公告",
  bulletinItems: [
    {
      title: "系统维护通知",
      meta: "今晚 23:00 进行短时维护，预计 15 分钟。",
      date: "2026-05-03"
    },
    {
      title: "内容审核规则更新",
      meta: "新增合规状态说明与处理流程。",
      date: "2026-05-02"
    },
    {
      title: "下载通道优化",
      meta: "会员下载链路已完成稳定性修正。",
      date: "2026-05-01"
    },
    {
      title: "站务说明",
      meta: "本区块可替换为后台可编辑公告模块。",
      date: "2026-04-30"
    }
  ],
  briefingEyebrow: "档案简报",
  archiveOverviewLabel: "档案概况",
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
      description: "新增独立的 Mod 分区，补强核心卡片资料库流程。"
    },
    {
      title: "帖子点赞",
      description: "加入帖子点赞功能，让成员更快标记有帮助的内容。"
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

export default async function HomePageBulletinDemoZhCn() {
  const [hotTopicContents, latestPublishedContents, overviewStats] = await Promise.all([
    getHomepageHotTopicContents(),
    getHomepageLatestPublishedContents(),
    getHomepageOverviewStats()
  ]);

  return (
    <HomePageBulletinDemoView
      hotTopicContents={hotTopicContents}
      latestPublishedContents={latestPublishedContents}
      overviewStats={overviewStats}
      copy={copy}
      locale="zh-CN"
    />
  );
}
