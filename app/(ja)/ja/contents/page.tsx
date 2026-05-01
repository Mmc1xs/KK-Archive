import type { Metadata } from "next";
import { ContentsPageView } from "@/components/contents-page-view";
import { getCurrentSession } from "@/lib/auth/session";
import { getBrowsableContentsPage } from "@/lib/content";

const PAGE_SIZE = 12;
export const preferredRegion = "hkg1";

export const metadata: Metadata = {
  title: "コンテンツ一覧 | KK Archive",
  description: "公開済みの KK コンテンツを閲覧し、カード、プリセット、シーン、テクスチャ、共有ファイルを探せます。"
};

export default async function ContentsPageJa({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentSession({ touchActivity: false });
  const pageParam = typeof params.page === "string" ? Number(params.page) : 1;
  const currentPage = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const { items, totalPages, totalCount } = await getBrowsableContentsPage(
    Boolean(user),
    currentPage,
    PAGE_SIZE,
    user?.role
  );

  return (
    <ContentsPageView
      items={items}
      currentPage={currentPage}
      totalPages={totalPages}
      totalCount={totalCount}
      pageSize={PAGE_SIZE}
      locale="ja"
      copy={{
        eyebrow: "閲覧可能ライブラリ",
        title: "公開コンテンツ",
        status: (page, pages, total) => `${page} / ${pages} ページ · ${total} 件`,
        previous: "前へ",
        next: "次へ",
        pageSummary: (pageSize) => `${pageSize} / ページ`,
        paginationLabel: "コンテンツページ送り"
      }}
    />
  );
}
