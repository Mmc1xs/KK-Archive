import type { Metadata } from "next";
import { ModLibraryPageView } from "@/components/mod-library-page-view";
import { getModLibraryPage } from "@/lib/mod-library";

export const revalidate = 300;
export const preferredRegion = "hkg1";

export const metadata: Metadata = {
  title: "Mod ライブラリ | KK Archive",
  description: "Mod 名、Guid、作者で検索できる共有 Mod 一覧です。"
};

function parsePositiveInt(value: string | string[] | undefined, fallback: number) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export default async function ModLibraryPageJa({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const page = parsePositiveInt(params.page, 1);
  const pageSize = parsePositiveInt(params.pageSize, 50);
  const pageResult = await getModLibraryPage({ query, page, pageSize });

  return (
    <ModLibraryPageView
      locale="ja"
      copy={{
        eyebrow: "Mod ライブラリ",
        title: "共有 Mod インデックス",
        description: "Mod 名・Guid・作者で検索できます。",
        searchLabel: "Mod を検索",
        searchPlaceholder: "名前 / Guid / 作者",
        searchButton: "検索",
        clearButton: "クリア",
        statusReady: "本番データ",
        statusDemo: "デモデータ",
        empty: "該当する Mod が見つかりません。",
        fields: {
          name: "名前",
          version: "バージョン",
          author: "作者",
          guid: "Guid",
          filename: "ファイル",
          messageLink: "メッセージリンク"
        },
        paginationLabel: "Mod ライブラリのページ送り",
        previous: "前へ",
        next: "次へ"
      }}
      items={pageResult.items}
      query={query}
      currentPage={pageResult.currentPage}
      totalPages={pageResult.totalPages}
      totalCount={pageResult.totalCount}
      pageSize={pageResult.pageSize}
      databaseReady={pageResult.databaseReady}
    />
  );
}
