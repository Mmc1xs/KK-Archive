import { LegalPageView } from "@/components/support-page-view";

export default function Usc2257PageJa() {
  return (
    <LegalPageView
      eyebrow="18 USC 2257 声明"
      title="18 USC 2257 記録保持コンプライアンス"
      sections={[
        {
          title: "二次配信者に関する通知",
          body: "KK Archive は、該当する場合において第三者コンテンツの索引・閲覧プラットフォームとして機能する二次配信者です。"
        },
        {
          title: "制作主体ではないこと",
          body: "KK Archive は第三者クリエイターの公開コンテンツを制作・委託していません。18 U.S.C. 2257 に基づく記録が必要な場合、その記録は元の制作者が保持します。"
        },
        {
          title: "年齢要件",
          body: "実在の性的描写が含まれる場合、被写体は制作時点で 18 歳以上であることを元の制作者が保証するものとします。"
        },
        {
          title: "問い合わせ窓口",
          body: "コンプライアンス、DMCA、権利関連の連絡先: mmc1xs@koikatsucards.com"
        }
      ]}
    />
  );
}

