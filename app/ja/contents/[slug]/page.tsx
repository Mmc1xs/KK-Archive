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
      title: "コンテンツが見つかりません | KK Archive"
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
    description: `KK Archive で ${content.title} を表示します。プレビュー画像、構造化タグ、元ソース情報、利用可能なダウンロードを確認できます。参考元: ${descriptionSource}。`
  };
}

export default async function ContentDetailPageJa({
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
      locale="ja"
      copy={{
        unverifiedTitle: "未確認コンテンツ",
        unverifiedBody: "この投稿はまだ完全に確認されていません。タグやメタデータが不完全または不正確な場合があります。",
        visibleContentEyebrow: "公開コンテンツ",
        edit: "編集",
        originalSource: "元ソース",
        downloadLinks: "ダウンロードリンク",
        telegramDownload: "Telegram ダウンロード",
        websiteDownload: "サイトダウンロード",
        websiteDownloads: (count) => `サイトダウンロード (${count})`,
        type: "種類",
        author: "作者",
        work: "作品",
        character: "キャラクター",
        style: "スタイル",
        usage: "用途",
        reviewStatus: {
          edited: "編集済み",
          passed: "確認済み",
          unverified: "未確認"
        }
      }}
    />
  );
}
