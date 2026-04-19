import { LegalPageView } from "@/components/support-page-view";

export default function AboutPageJa() {
  return (
    <LegalPageView
      eyebrow="KK Archive について"
      title="このアーカイブの運用方針"
      sections={[
        {
          title: "ミッション",
          body: "KK Archive は Koikatsu 関連カードと共有ファイルを構造化して閲覧できるサイトです。安定したカテゴリとタグ整理で、発見を速く正確にすることを目的としています。"
        },
        {
          title: "提供範囲",
          body: "公開済みエントリの閲覧、フィルタ、索引管理を中心に提供します。公開アップロードプラットフォームではありません。"
        },
        {
          title: "コンテンツ構造",
          body: "各エントリは固定メタデータとタグセットで管理され、フリーテキスト推測ではなく既存タグで検索できる設計です。"
        },
        {
          title: "品質とレビュー",
          body: "メタデータとリンクは継続的に見直し、表記ゆれや不整合を減らして信頼性を維持します。"
        },
        {
          title: "透明性",
          body: "運用ルールとポリシーはフッターの Privacy / Contact / Terms に記載しています。更新が必要な場合は随時反映します。"
        }
      ]}
    />
  );
}
