import { LegalPageView } from "@/components/support-page-view";

export default function ContactPageJa() {
  return (
    <LegalPageView
      eyebrow="お問い合わせ"
      title="KK Archive への連絡先"
      sections={[
        {
          title: "ビジネス問い合わせ",
          body: "提携や業務相談は次のメールへご連絡ください: mmc1xs@koikatsucards.com"
        },
        {
          title: "著作権・削除申請",
          body: "削除が必要な場合は、対象ページ URL、権利証明、具体的な依頼内容を含めてお送りください。"
        },
        {
          title: "アカウントとセキュリティ",
          body: "ログイン問題、不審な挙動、悪用報告は、発生時刻と可能なスクリーンショットを添えてご連絡ください。"
        },
        {
          title: "返信目安",
          body: "通常は 3〜7 営業日以内に返信します。権利確認が複雑な案件は追加時間が必要な場合があります。"
        }
      ]}
    />
  );
}
