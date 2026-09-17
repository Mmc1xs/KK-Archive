import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentDetailView } from "@/components/content-detail-view";
import { getBrowsableContentBySlug, getBrowsableContentMetadataBySlug } from "@/lib/content";
import { getPrimaryTagName, normalizeContentDownloadEntries, normalizeTypeLabel } from "@/lib/content-detail";

export const preferredRegion = "hkg1";
export const dynamic = "force-static";
export const revalidate = 900;

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
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const content = await getBrowsableContentBySlug(slug, false);

  if (!content) {
    notFound();
  }

  const { tgDownloadLink, siteDownloadEntries, apexDriveEntries } = normalizeContentDownloadEntries(content);

  return (
    <ContentDetailView
      content={content}
      tgDownloadLink={tgDownloadLink}
      siteDownloadEntries={siteDownloadEntries}
      apexDriveEntries={apexDriveEntries}
      locale="ja"
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
        apexDriveDownload: "ApexDrive ダウンロード",
        apexDriveDownloads: (count) => `ApexDrive ダウンロード (${count})`,
        websiteDownloadLoginRequired: "サイトダウンロードはログイン済みメンバーのみ利用できます。",
        login: "ログイン",
        adBlockNotice: {
          title: "広告ブロックが検出されました",
          body: "広告ブロッカーを無効にするか、このサイトを許可リストに追加してください。広告収益でダウンロードと更新を維持しています。",
          action: "無効にしました",
          close: "閉じる"
        },
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
