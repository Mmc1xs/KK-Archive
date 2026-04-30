import { LegalPageView } from "@/components/support-page-view";

export default function ContactPageZhCn() {
  return (
    <LegalPageView
      eyebrow="联系"
      title="联系 KK Archive 团队"
      sections={[
        {
          title: "商务合作",
          body: "商务或合作咨询请发送邮件至：mmc1xs@koikatsucards.com"
        },
        {
          title: "版权与下架请求",
          body: "若需移除特定内容，请附上受影响页面 URL、权利证明及明确请求说明，便于我们正确处理。也可参考页脚中的 DMCA 下架政策页面。"
        },
        {
          title: "账号与安全反馈",
          body: "如遇账号访问异常、可疑行为或滥用情况，请提供清晰描述、相关时间点与可用截图。"
        },
        {
          title: "回复时间",
          body: "我们通常会在 3 到 7 个工作日内回复。复杂版权或归属争议可能需要额外核验时间。"
        }
      ]}
    />
  );
}
