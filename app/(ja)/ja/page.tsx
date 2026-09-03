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
  telegramGroupEyebrow: "コミュニティ",
  telegramGroupTitle: "KK Archive Telegram に参加",
  telegramGroupDescription: "更新情報、ファイル共有のお知らせ、不具合報告の案内を確認できます。",
  telegramGroupActionLabel: "グループを開く",
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
  downloadPanelEyebrow: "クリーンソース",
  downloadPanelTitle: "本体ダウンロード",
  downloadPanelDescription: "対応する本体パッケージを先に取得し、アーカイブ内のカード、シーン、Mod と組み合わせて使えます。",
  downloadCards: [
    {
      code: "KK",
      title: "Koikatsu Party",
      description: "多くの KK カードと旧来リソース向けの学園系本体ソースです。",
      href: getLocaleInstallVersionHref("ja", "kk"),
      iconUrl: "https://cdn2.steamgriddb.com/grid/eacac8618eb5b3240debd191db819910.jpg",
      actionLabel: "手順を見る",
      disabledLabel: "接続待ち"
    },
    {
      code: "KKS",
      title: "Koikatsu Sunshine",
      description: "KKS 用クラウドフォルダに接続するためのサンシャイン版ソース枠です。",
      href: getLocaleInstallVersionHref("ja", "kks"),
      iconUrl: "https://cdn2.steamgriddb.com/grid/fdbfb9f7a6e4aa57039a56775046451b.png",
      actionLabel: "手順を見る",
      disabledLabel: "接続待ち"
    }
  ],
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
