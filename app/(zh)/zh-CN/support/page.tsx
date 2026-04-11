import { SupportPageView } from "@/components/support-page-view";

const PAYMENT_URL = "https://nowpayments.io/payment/?iid=5997887528";

export default function SupportPageZhCn() {
  return (
    <SupportPageView
      titleEyebrow="支持 KK Archive"
      title="让档案库持续运行并继续成长"
      paragraphs={[
        "KK Archive 的目标是让卡片分享更整洁、更快速，也更容易使用。我们正从基础浏览逐步扩展到更长期的社区平台，加入更好的整理、审核工具与创作者支持流程。",
        "你的支持可以帮助我们承担储存、带宽与开发时间成本，让我们持续提升搜索质量、扩充新的资料区，并维持网站稳定运作。",
        "如果这个档案库替你节省了时间，或帮助了你的工作流程，你可以在下方支持下一阶段的开发。"
      ]}
      supportLabel="通过 NOWPayments 支持"
      backLabel="返回首页"
      backHref="/zh-CN"
      paymentUrl={PAYMENT_URL}
    />
  );
}
