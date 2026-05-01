import type { Metadata } from "next";
import { SearchPageView } from "@/components/search-page-view";
import { getCurrentSession } from "@/lib/auth/session";
import { getSearchFilterBootstrap, searchPublishedContents } from "@/lib/content";

const PAGE_SIZE = 12;
export const preferredRegion = "hkg1";

export const metadata: Metadata = {
  title: "タグ検索 | KK Archive",
  description: "作者、作品、キャラクター、スタイル、用途、種類で KK コンテンツを絞り込めます。"
};

function readValues(value: string | string[] | undefined) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export default async function SearchPageJa({
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
      viewerRole: user?.role,
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
      locale="ja"
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
        filtersEyebrow: "検索フィルター",
        filtersTitle: "タグ検索",
        resultsEyebrow: "表示結果",
        resultsTitle: "検索結果",
        status: (page, shownCount) => `${page} ページ · ${shownCount} 件表示`,
        previous: "前へ",
        next: "次へ",
        pageCurrent: (page) => `${page} ページ`,
        pageSummary: (pageSize) => `${pageSize} / ページ`,
        paginationLabel: "検索ページ送り",
        filterLabels: {
          author: "作者",
          work: "作品",
          character: "キャラクター",
          type: "種類",
          style: "スタイル",
          usage: "用途",
          searchAuthorPlaceholder: "作者を検索",
          searchWorkPlaceholder: "作品を検索",
          searchCharacterPlaceholder: "キャラクターを検索",
          selectWorkFirstPlaceholder: "先に作品を選択",
          clear: "クリア",
          searching: "検索中...",
          noMatchingAuthors: "一致する作者がありません。",
          noMatchingWorks: "一致する作品がありません。",
          selectWorkFirst: "先に作品を選択してください。",
          noMatchingCharacters: "一致するキャラクターがありません。",
          styleLabelTemplate: "スタイル ({count}/{max})",
          noStyleSelected: "スタイル未選択。",
          searchStylePlaceholder: "スタイルを検索",
          maximumStyleTags: "スタイルタグは最大 {count} 個まで",
          noMatchingStyles: "一致するスタイルがありません。",
          noUsageSelected: "用途未選択。",
          searchUsagePlaceholder: "用途を検索",
          noMatchingUsages: "一致する用途がありません。",
          applyFilters: "フィルター適用",
          clearFilters: "クリア",
          unknownAuthor: "不明な作者",
          unknownWork: "不明な作品",
          unknownCharacter: "不明なキャラクター"
        }
      }}
    />
  );
}
