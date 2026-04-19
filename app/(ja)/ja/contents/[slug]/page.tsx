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
    description: `KK Archiveで${content.title}を表示。プレビュー画像、構造化タグ、元ソース情報、利用可能なダウンロード先を確認できます。参考: ${descriptionSource}。`
  };
}

export default async function ContentDetailPageJa({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const success = typeof query.success === "string" ? query.success : undefined;
  const error = typeof query.error === "string" ? query.error : undefined;
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
      flashMessage={
        success
          ? { type: "success", message: "報告を受け付けました。ありがとうございます。" }
          : error
            ? { type: "error", message: error }
            : undefined
      }
      copy={{
        unverifiedTitle: "未検証コンテンツ",
        unverifiedBody: "この投稿はまだ完全に確認されていません。タグやメタデータが不完全、または不正確な場合があります。",
        visibleContentEyebrow: "公開コンテンツ",
        edit: "編集",
        originalSource: "元ソース",
        downloadLinks: "ダウンロードリンク",
        telegramDownload: "TG ダウンロード",
        websiteDownload: "サイトダウンロード",
        websiteDownloads: (count) => `サイトダウンロード (${count})`,
        type: "タイプ",
        author: "作者",
        work: "作品",
        character: "キャラクター",
        style: "スタイル",
        usage: "用途",
        reviewStatus: {
          edited: "編集済み",
          passed: "確認済み",
          unverified: "未検証"
        }
      }}
    />
  );
}
