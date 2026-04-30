import { LegalPageView } from "@/components/support-page-view";

export default function Usc2257PageZhCn() {
  return (
    <LegalPageView
      eyebrow="18 USC 2257 声明"
      title="18 USC 2257 记录保存合规声明"
      sections={[
        {
          title: "二级分发说明",
          body: "KK Archive 在适用情况下作为第三方内容的索引与浏览平台，属于二级分发方。"
        },
        {
          title: "非内容制作方",
          body: "KK Archive 不制作、委托或拍摄第三方创作者发布的内容。若内容适用 18 U.S.C. 2257 记录要求，相关记录由原始制作方保存。"
        },
        {
          title: "年龄要求",
          body: "若内容涉及真实露骨性行为画面，被展示人员在制作时须年满 18 周岁，该事实由原始制作方负责。"
        },
        {
          title: "合规联系渠道",
          body: "如需提交合规、DMCA 或权利相关请求，请联系：mmc1xs@koikatsucards.com。"
        }
      ]}
    />
  );
}

