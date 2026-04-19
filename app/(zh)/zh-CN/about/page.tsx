import { LegalPageView } from "@/components/support-page-view";

export default function AboutPageZhCn() {
  return (
    <LegalPageView
      eyebrow="关于 KK Archive"
      title="本站的定位与运作方式"
      sections={[
        {
          title: "使命",
          body: "KK Archive 是一个面向 Koikatsu 相关卡片与分享文件的结构化浏览站。我们希望通过稳定的分类与标签体系，让内容发现更高效、更可维护。"
        },
        {
          title: "提供内容",
          body: "本站主要提供已发布条目的浏览、筛选与索引管理，不提供公开上传功能。"
        },
        {
          title: "内容结构",
          body: "每条内容都采用固定元数据与标签集合，用户可通过数据库既有标签浏览，而不是依赖自由关键词猜测。"
        },
        {
          title: "质量与审核",
          body: "我们会持续修正标签与链接，提升一致性并减少不完整记录，保持索引可靠性。"
        },
        {
          title: "透明度",
          body: "政策与运营规则请参阅页脚的 Privacy、Contact 与 Terms。若流程或规则调整，我们会同步更新页面。"
        }
      ]}
    />
  );
}
