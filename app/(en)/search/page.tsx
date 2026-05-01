import type { Metadata } from "next";
import { SearchPageView } from "@/components/search-page-view";
import { getCurrentSession } from "@/lib/auth/session";
import { getSearchFilterBootstrap, searchPublishedContents } from "@/lib/content";

const PAGE_SIZE = 12;
export const preferredRegion = "hkg1";

export const metadata: Metadata = {
  title: "Search Koikatsu Cards by Tags | Koikatsu Card Archive",
  description:
    "Search Koikatsu cards, presets, scenes, textures, overlays, and shared files by author, work, character, style, usage, and type."
};

function readValues(value: string | string[] | undefined) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export default async function SearchPage({
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
      locale="en"
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
        filtersEyebrow: "Search Filters",
        filtersTitle: "Tag Search",
        resultsEyebrow: "Visible Results",
        resultsTitle: "Search Results",
        status: (page, shownCount) => `Page ${page} - ${shownCount} shown`,
        previous: "Previous",
        next: "Next",
        pageCurrent: (page) => `Page ${page}`,
        pageSummary: (pageSize) => `${pageSize} / page`,
        paginationLabel: "Search pagination",
        filterLabels: {
          author: "Author",
          work: "Work",
          character: "Character",
          type: "Type",
          style: "Style",
          usage: "Usage",
          searchAuthorPlaceholder: "Search author",
          searchWorkPlaceholder: "Search work",
          searchCharacterPlaceholder: "Search character",
          selectWorkFirstPlaceholder: "Select work first",
          clear: "Clear",
          searching: "Searching...",
          noMatchingAuthors: "No matching authors.",
          noMatchingWorks: "No matching works.",
          selectWorkFirst: "Select a work first.",
          noMatchingCharacters: "No matching characters.",
          styleLabelTemplate: "Style ({count}/{max})",
          noStyleSelected: "No style selected.",
          searchStylePlaceholder: "Search style",
          maximumStyleTags: "Maximum {count} style tags",
          noMatchingStyles: "No matching styles.",
          noUsageSelected: "No usage selected.",
          searchUsagePlaceholder: "Search usage",
          noMatchingUsages: "No matching usages.",
          applyFilters: "Apply Filters",
          clearFilters: "Clear",
          unknownAuthor: "Unknown author",
          unknownWork: "Unknown work",
          unknownCharacter: "Unknown character"
        }
      }}
    />
  );
}
