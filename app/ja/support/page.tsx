import { SupportPageView } from "@/components/support-page-view";

const PAYMENT_URL = "https://nowpayments.io/payment/?iid=5997887528";

export default function SupportPageJa() {
  return (
    <SupportPageView
      titleEyebrow="KK Archive を支援"
      title="アーカイブを維持し、さらに成長させるために"
      paragraphs={[
        "KK Archive はカード共有をより整理され、より速く、より使いやすくするために作られています。現在は基本閲覧から一歩進み、より長期的なコミュニティ基盤へと拡張中です。",
        "ご支援はストレージ、帯域、開発時間の確保に使われ、検索品質の改善、新しいライブラリ区画の追加、安定運用の継続に役立ちます。",
        "このアーカイブが時間短縮や作業の助けになったなら、次の開発段階をぜひご支援ください。"
      ]}
      supportLabel="NOWPayments で支援"
      backLabel="ホームに戻る"
      backHref="/ja"
      paymentUrl={PAYMENT_URL}
    />
  );
}
