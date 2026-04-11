import type { Metadata } from "next";
import { SearchPageView } from "@/components/search-page-view";
import { getCurrentSession } from "@/lib/auth/session";
import { getSearchFilterBootstrap, searchPublishedContents } from "@/lib/content";

const PAGE_SIZE = 12;
export const preferredRegion = "hkg1";

export const metadata: Metadata = {
  title: "标签搜索 | KK Archive",
  description: "按作者、作品、角色、风格、用途与类型筛选 KK 内容。"
};

function readValues(value: string | string[] | undefined) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export default async function SearchPageZhCn({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const author = typeof params.author === "string" ? params.author : undefined;
  const work = typeof params.work === "string" ? params.work : undefined;
  const character = typeof params.character === "string" ? params.character : undefined;
  const styles = readValues(params.styles);
  const usages = readValues(params.usages);
  const types = readValues(params.types);
  const pageParam = typeof params.page === "string" ? Number(params.page) : 1;
  const currentPage = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const user = await getCurrentSession({ touchActivity: false });

  const [searchFilterBootstrap, resultsPage] = await Promise.all([
    getSearchFilterBootstrap({ author, work, character, styles, usages }),
    searchPublishedContents({
      isLoggedIn: Boolean(user),
      author,
      work,
      character,
      styles,
      usages,
      types,
      page: currentPage,
      pageSize: PAGE_SIZE
    })
  ]);

  return (
    <SearchPageView
      locale="zh-CN"
      types={searchFilterBootstrap.types}
      initialAuthor={searchFilterBootstrap.selectedAuthor}
      initialWork={searchFilterBootstrap.selectedWork}
      initialCharacter={searchFilterBootstrap.selectedCharacter}
      initialStyles={searchFilterBootstrap.selectedStyles}
      initialUsages={searchFilterBootstrap.selectedUsages}
      initialTypes={types}
      resultsPage={resultsPage}
      filters={{ author, work, character, styles, usages, types }}
      copy={{
        filtersEyebrow: "搜索筛选",
        filtersTitle: "标签搜索",
        resultsEyebrow: "可见结果",
        resultsTitle: "搜索结果",
        status: (page, shownCount) => `第 ${page} 页 · 显示 ${shownCount} 项`,
        previous: "上一页",
        next: "下一页",
        pageCurrent: (page) => `第 ${page} 页`,
        pageSummary: (pageSize) => `${pageSize} / 页`,
        paginationLabel: "搜索分页",
        filterLabels: {
          author: "作者",
          work: "作品",
          character: "角色",
          type: "类型",
          style: "风格",
          usage: "用途",
          searchAuthorPlaceholder: "搜索作者",
          searchWorkPlaceholder: "搜索作品",
          searchCharacterPlaceholder: "搜索角色",
          selectWorkFirstPlaceholder: "请先选择作品",
          clear: "清除",
          searching: "搜索中...",
          noMatchingAuthors: "没有匹配的作者。",
          noMatchingWorks: "没有匹配的作品。",
          selectWorkFirst: "请先选择作品。",
          noMatchingCharacters: "没有匹配的角色。",
          styleLabelTemplate: "风格 ({count}/{max})",
          noStyleSelected: "尚未选择风格。",
          searchStylePlaceholder: "搜索风格",
          maximumStyleTags: "最多可选 {count} 个风格标签",
          noMatchingStyles: "没有匹配的风格。",
          noUsageSelected: "尚未选择用途。",
          searchUsagePlaceholder: "搜索用途",
          noMatchingUsages: "没有匹配的用途。",
          applyFilters: "过滤",
          clearFilters: "清空",
          unknownAuthor: "未知作者",
          unknownWork: "未知作品",
          unknownCharacter: "未知角色"
        }
      }}
    />
  );
}
