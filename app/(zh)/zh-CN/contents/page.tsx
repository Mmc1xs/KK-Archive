import type { Metadata } from "next";
import { ContentsPageView } from "@/components/contents-page-view";
import { getCurrentSession } from "@/lib/auth/session";
import { getBrowsableContentsPage } from "@/lib/content";

const PAGE_SIZE = 12;
export const preferredRegion = "hkg1";

export const metadata: Metadata = {
  title: "浏览内容 | KK Archive",
  description: "浏览已发布的 KK 内容，包括角色卡、预设、场景、贴图、覆盖层和共享文件。"
};

export default async function ContentsPageZhCn({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentSession({ touchActivity: false });
  const pageParam = typeof params.page === "string" ? Number(params.page) : 1;
  const currentPage = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const { items, totalPages, totalCount } = await getBrowsableContentsPage(Boolean(user), currentPage, PAGE_SIZE);

  return (
    <ContentsPageView
      items={items}
      currentPage={currentPage}
      totalPages={totalPages}
      totalCount={totalCount}
      pageSize={PAGE_SIZE}
      locale="zh-CN"
      copy={{
        eyebrow: "可浏览内容",
        title: "内容列表",
        status: (page, pages, total) => `第 ${page} / ${pages} 页 · 共 ${total} 帖`,
        previous: "上一页",
        next: "下一页",
        pageSummary: (pageSize) => `${pageSize} / 页`,
        paginationLabel: "内容分页"
      }}
    />
  );
}
