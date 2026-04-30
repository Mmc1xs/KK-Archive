import { LegalPageView } from "@/components/support-page-view";

export default function DmcaPageZhCn() {
  return (
    <LegalPageView
      eyebrow="DMCA 下架政策"
      title="版权通知与下架处理流程"
      sections={[
        {
          title: "如何提交 DMCA 通知",
          body: "请发送邮件至 mmc1xs@koikatsucards.com，邮件标题建议使用：DMCA Takedown Request。"
        },
        {
          title: "通知所需信息",
          body: "请提供你的法定姓名、联系邮箱、被侵权作品说明、需下架的准确 URL、善意声明，以及你有权代表权利人的声明。"
        },
        {
          title: "审核与下架",
          body: "收到完整通知后，我们会进行审核，并可能在核验期间先行移除或限制访问被举报内容。"
        },
        {
          title: "反通知（Counter-Notice）",
          body: "若内容被误下架，受影响方可提交有效反通知。我们会在适用法律允许范围内处理并可能恢复内容。"
        },
        {
          title: "重复侵权处理",
          body: "对多次被有效举报侵权的账号或投稿来源，我们可能采取限制发布或移除处理。"
        }
      ]}
    />
  );
}

