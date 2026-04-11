import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentDetailView } from "@/components/content-detail-view";
import { getCurrentSession } from "@/lib/auth/session";
import { getBrowsableContentBySlug, getBrowsableContentMetadataBySlug, recordContentView } from "@/lib/content";
import { getPrimaryTagName, normalizeContentDownloadEntries, normalizeTypeLabel } from "@/lib/content-detail";

export const preferredRegion = "hkg1";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const content = await getBrowsableContentMetadataBySlug(slug);

  if (!content) {
    return {
      title: "内容不存在 | KK Archive"
    };
  }

  const work = getPrimaryTagName(content, "WORK");
  const character = getPrimaryTagName(content, "CHARACTER");
  const author = getPrimaryTagName(content, "AUTHOR");
  const type = normalizeTypeLabel(getPrimaryTagName(content, "TYPE"));
  const normalizedCharacter = character?.toLowerCase();
  const useCharacter =
    normalizedCharacter && normalizedCharacter !== "unknown character" && normalizedCharacter !== "unknown";

  const titleParts = [useCharacter ? character : content.title, work, `Koikatsu ${type}`].filter(Boolean);
  const descriptionSource = work ?? author ?? "KK Archive";

  return {
    title: titleParts.join(" | "),
    description: `在 KK Archive 查看 ${content.title}，包含预览图、结构化标签、原始来源与可用下载方式。来源参考：${descriptionSource}。`
  };
}

export default async function ContentDetailPageZhCn({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentSession({ touchActivity: false });
  const content = await getBrowsableContentBySlug(slug, Boolean(user));

  if (!content) {
    notFound();
  }

  void recordContentView(content.id).catch(() => {
    // Non-blocking analytics: view tracking failures should not block page rendering.
  });

  const { tgDownloadLink, siteDownloadEntries } = normalizeContentDownloadEntries(content);

  return (
    <ContentDetailView
      content={content}
      user={user}
      tgDownloadLink={tgDownloadLink}
      siteDownloadEntries={siteDownloadEntries}
      locale="zh-CN"
      copy={{
        unverifiedTitle: "未校验内容",
        unverifiedBody: "这篇帖子尚未完成校对，标签与元数据可能仍不完整或不准确。",
        visibleContentEyebrow: "公开内容",
        edit: "编辑",
        originalSource: "原始来源",
        downloadLinks: "下载链接",
        telegramDownload: "TG 下载",
        websiteDownload: "网站下载",
        websiteDownloads: (count) => `网站下载 (${count})`,
        type: "类型",
        author: "作者",
        work: "作品",
        character: "角色",
        style: "风格",
        usage: "用途",
        reviewStatus: {
          edited: "已编辑",
          passed: "已通过",
          unverified: "未校验"
        }
      }}
    />
  );
}
