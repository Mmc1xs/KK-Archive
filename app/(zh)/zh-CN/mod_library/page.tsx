import type { Metadata } from "next";
import { ModLibraryPageView } from "@/components/mod-library-page-view";
import { getModLibraryPage } from "@/lib/mod-library";

export const revalidate = 300;
export const preferredRegion = "hkg1";

export const metadata: Metadata = {
  title: "Mod 库 | KK Archive",
  description: "可按 Mod 名称、Guid、作者搜索的共享 Mod 列表。"
};

function parsePositiveInt(value: string | string[] | undefined, fallback: number) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export default async function ModLibraryPageZhCn({
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
      locale="zh-CN"
      copy={{
        eyebrow: "Mod 库",
        title: "共享 Mod 索引",
        description: "可按名称、Guid、作者直接搜索。",
        searchLabel: "搜索 Mod",
        searchPlaceholder: "名称 / Guid / 作者",
        searchButton: "搜索",
        clearButton: "清除",
        statusReady: "正式数据",
        statusDemo: "演示数据",
        empty: "未找到符合条件的 Mod。",
        fields: {
          name: "名称",
          version: "版本",
          author: "作者",
          guid: "Guid",
          filename: "文件名",
          messageLink: "消息链接"
        },
        paginationLabel: "Mod 库分页",
        previous: "上一页",
        next: "下一页"
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
