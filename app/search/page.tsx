import type { Metadata } from "next";
import Link from "next/link";
import { ContentCard } from "@/components/content-card";
import { SearchFilters } from "@/components/search-filters";
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

function buildSearchHref(options: {
  page: number;
  author?: string;
  styles: string[];
  usages: string[];
  types: string[];
}) {
  const params = new URLSearchParams();

  if (options.author) {
    params.set("author", options.author);
  }

  options.styles.forEach((slug) => params.append("styles", slug));
  options.usages.forEach((slug) => params.append("usages", slug));
  options.types.forEach((slug) => params.append("types", slug));

  if (options.page > 1) {
    params.set("page", String(options.page));
  }

  const query = params.toString();
  return query ? `/search?${query}` : "/search";
}

export default async function SearchPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const author = typeof params.author === "string" ? params.author : undefined;
  const styles = readValues(params.styles);
  const usages = readValues(params.usages);
  const types = readValues(params.types);
  const pageParam = typeof params.page === "string" ? Number(params.page) : 1;
  const currentPage = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const user = await getCurrentSession({ touchActivity: false });

  const [searchFilterBootstrap, resultsPage] = await Promise.all([
    getSearchFilterBootstrap({ author, styles, usages }),
    searchPublishedContents({
      isLoggedIn: Boolean(user),
      author,
      styles,
      usages,
      types,
      page: currentPage,
      pageSize: PAGE_SIZE
    })
  ]);

  return (
    <div className="page-section search-layout">
      <aside className="panel search-filters-panel">
        <div className="eyebrow">Search Filters</div>
        <h1 className="title-lg">Tag Search</h1>
        <SearchFilters
          types={searchFilterBootstrap.types}
          initialAuthor={searchFilterBootstrap.selectedAuthor}
          initialStyles={searchFilterBootstrap.selectedStyles}
          initialUsages={searchFilterBootstrap.selectedUsages}
          initialTypes={types}
        />
      </aside>

      <section className="panel search-results-panel">
        <div className="split">
          <div>
            <div className="eyebrow">Visible Results</div>
            <h2 className="title-lg">Search Results</h2>
          </div>
          <span className="status">{`Page ${resultsPage.page} - ${resultsPage.items.length} shown`}</span>
        </div>

        <div className="grid content-grid search-results-grid">
          {resultsPage.items.map((content) => (
            <ContentCard key={content.id} content={content} />
          ))}
        </div>

        {resultsPage.hasPrevious || resultsPage.hasNext ? (
          <nav className="pagination-nav" aria-label="Search pagination">
            <Link
              href={buildSearchHref({
                page: resultsPage.hasPrevious ? resultsPage.page - 1 : 1,
                author,
                styles,
                usages,
                types
              })}
              className={
                resultsPage.hasPrevious ? "link-pill pagination-arrow" : "link-pill pagination-arrow pagination-disabled"
              }
              aria-disabled={!resultsPage.hasPrevious}
            >
              Previous
            </Link>
            <div className="pagination-pages">
              <span className="button secondary pagination-page-current" aria-current="page">
                {`Page ${resultsPage.page}`}
              </span>
              <span className="pagination-summary">{resultsPage.pageSize} / page</span>
            </div>
            <Link
              href={buildSearchHref({
                page: resultsPage.hasNext ? resultsPage.page + 1 : resultsPage.page,
                author,
                styles,
                usages,
                types
              })}
              className={
                resultsPage.hasNext
                  ? "link-pill pagination-arrow"
                  : "link-pill pagination-arrow pagination-disabled"
              }
              aria-disabled={!resultsPage.hasNext}
            >
              Next
            </Link>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
