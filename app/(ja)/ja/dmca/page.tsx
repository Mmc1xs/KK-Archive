import { LegalPageView } from "@/components/support-page-view";

export default function DmcaPageJa() {
  return (
    <LegalPageView
      eyebrow="DMCA 削除ポリシー"
      title="著作権通知と削除対応手続き"
      sections={[
        {
          title: "DMCA 通知の送付先",
          body: "件名を「DMCA Takedown Request」として、mmc1xs@koikatsucards.com へ送信してください。"
        },
        {
          title: "通知に必要な情報",
          body: "氏名、連絡先メール、権利対象の特定、削除対象 URL、善意の申立て、ならびに権限を有する旨の宣誓文を含めてください。"
        },
        {
          title: "審査と削除対応",
          body: "有効な通知を受領後、内容を確認し、審査中は対象コンテンツを一時的に非表示またはアクセス停止にする場合があります。"
        },
        {
          title: "異議申立て（Counter-Notice）",
          body: "誤削除の場合、影響を受けた当事者は有効な異議申立てを提出できます。法令に従いコンテンツを復旧することがあります。"
        },
        {
          title: "反復侵害者への対応",
          body: "有効な著作権侵害通知が繰り返されるアカウントや投稿者には、制限または削除対応を行う場合があります。"
        }
      ]}
    />
  );
}

