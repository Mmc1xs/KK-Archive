import type { Metadata } from "next";
import { HomePageView } from "@/components/home-page-view";
import {
  getHomepageBulletins,
  getHomepageHotTopicContents,
  getHomepageLatestPublishedContents,
  getHomepageOverviewStats
} from "@/lib/content";

export const revalidate = 300;
export const preferredRegion = "hkg1";

export const metadata: Metadata = {
  title: "KK Archive | 日本語ホーム",
  description: "構造化タグで KK Archive を閲覧し、キャラクターカード、シーン、テクスチャ、共有ファイルを探せます。"
};

const copy = {
  heroEyebrow: "KK ファイル索引",
  heroScreenReaderTitle: "整理されたタグで KK 関連ファイルを探せます。",
  featurePills: ["キャラクターカード", "シーンプリセット", "テクスチャとオーバーレイ"] as [string, string, string],
  searchArchiveLabel: "アーカイブ検索",
  browseFilesLabel: "ファイル一覧",
  briefingEyebrow: "アーカイブ概要",
  archiveOverviewLabel: "アーカイブ概要",
  onlineLabel: "稼働中",
  totalPostsEyebrow: "公開投稿数",
  totalPostsDescription: "現在アーカイブで閲覧できる公開エントリー数",
  indexedAuthorsEyebrow: "作者タグ数",
  indexedAuthorsDescription: "構造化閲覧で利用できる作者タグ数",
  spotlightEyebrow: "注目エントリー",
  spotlightFallbackTitle: "最新のアーカイブ項目",
  spotlightFallbackAuthor: "KK Archive",
  roadmapEyebrow: "今後の予定",
  roadmapItems: [
    {
      title: "Mod ライブラリ",
      description: "カード中心の流れを補強できる専用 Mod ライブラリを追加予定です。"
    },
    {
      title: "投稿いいね",
      description: "役立つ投稿をすぐに共有できるよう、いいね機能を追加予定です。"
    }
  ],
  reservedEyebrow: "予約パネル",
  reservedLabel: "今後の枠",
  hotTopicEyebrow: "注目トピック",
  hotTopicTitle: "注目トピック",
  latestPublishedEyebrow: "最新公開",
  latestPublishedTitle: "最新公開コンテンツ",
  viewMoreLabel: "もっと見る"
};

export default async function HomePageJa() {
  const [hotTopicContents, latestPublishedContents, bulletins, overviewStats] = await Promise.all([
    getHomepageHotTopicContents(),
    getHomepageLatestPublishedContents(),
    getHomepageBulletins("ja"),
    getHomepageOverviewStats()
  ]);

  return (
    <HomePageView
      hotTopicContents={hotTopicContents}
      latestPublishedContents={latestPublishedContents}
      bulletins={bulletins}
      overviewStats={overviewStats}
      copy={copy}
      locale="ja"
    />
  );
}
