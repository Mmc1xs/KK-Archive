import { LegalPageView } from "@/components/support-page-view";

export default function TermsPageZhCn() {
  return (
    <LegalPageView
      eyebrow="使用条款"
      title="使用 KK Archive 的规则"
      sections={[
        {
          title: "同意条款",
          body: "使用本站即表示你同意本条款及当前发布的 Privacy 页面内容。若不同意，请停止使用本站。"
        },
        {
          title: "使用范围",
          body: "本站用于已发布内容的浏览、索引与参考。禁止恶意自动化访问、恶意抓取及影响服务稳定性的行为。"
        },
        {
          title: "账号与访问",
          body: "部分功能需要登录会员账号。你需对自己会话下的访问行为负责，不得滥用受保护路由。"
        },
        {
          title: "内容与外部链接",
          body: "条目可能包含第三方引用或下载链接。其可用性、归属状态及外部站点行为可能在无通知情况下变化。"
        },
        {
          title: "服务变更",
          body: "为维持稳定性、安全性与政策合规，我们可能调整、暂停或移除部分功能，也可能在必要时更新本条款。"
        },
        {
          title: "责任限制",
          body: "本站按现状提供。在法律允许范围内，我们不对使用本站或第三方资源导致的直接或间接损失承担责任。"
        }
      ]}
    />
  );
}
