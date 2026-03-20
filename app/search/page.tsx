import Link from "next/link";
import { ContentCard } from "@/components/content-card";
import { SearchFilters } from "@/components/search-filters";
import { getCurrentSession } from "@/lib/auth/session";
import { getSearchFilterBootstrap, searchPublishedContents } from "@/lib/content";

const PAGE_SIZE = 12;

function readValues(value: string | string[] | undefined) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function buildPagination(totalPages: number, currentPage: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1) as Array<number | "ellipsis">;
  }

  const pages = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);

  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }

  if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }

  const sortedPages = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const items: Array<number | "ellipsis"> = [];

  sortedPages.forEach((page, index) => {
    if (index > 0 && page - sortedPages[index - 1] > 1) {
      items.push("ellipsis");
    }
    items.push(page);
  });

  return items;
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
  const user = await getCurrentSession();

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
  const paginationItems = buildPagination(resultsPage.totalPages, resultsPage.page);

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
          <span className="status">{`Page ${resultsPage.page} / ${resultsPage.totalPages} - ${resultsPage.totalCount} results`}</span>
        </div>

        <div className="grid content-grid search-results-grid">
          {resultsPage.items.map((content) => (
            <ContentCard key={content.id} content={content} />
          ))}
        </div>

        {resultsPage.totalPages > 1 ? (
          <nav className="pagination-nav" aria-label="Search pagination">
            <Link
              href={buildSearchHref({
                page: resultsPage.page > 1 ? resultsPage.page - 1 : 1,
                author,
                styles,
                usages,
                types
              })}
              className={
                resultsPage.page > 1 ? "link-pill pagination-arrow" : "link-pill pagination-arrow pagination-disabled"
              }
              aria-disabled={resultsPage.page <= 1}
            >
              Previous
            </Link>
            <div className="pagination-pages">
              {paginationItems.map((item, index) =>
                item === "ellipsis" ? (
                  <span key={`ellipsis-${index}`} className="pagination-ellipsis" aria-hidden="true">
                    ...
                  </span>
                ) : (
                  <Link
                    key={item}
                    href={buildSearchHref({ page: item, author, styles, usages, types })}
                    className={
                      item === resultsPage.page ? "button secondary pagination-page-current" : "link-pill pagination-page"
                    }
                    aria-current={item === resultsPage.page ? "page" : undefined}
                  >
                    {item}
                  </Link>
                )
              )}
              <span className="pagination-summary">{resultsPage.pageSize} / page</span>
            </div>
            <Link
              href={buildSearchHref({
                page: resultsPage.page < resultsPage.totalPages ? resultsPage.page + 1 : resultsPage.totalPages,
                author,
                styles,
                usages,
                types
              })}
              className={
                resultsPage.page < resultsPage.totalPages
                  ? "link-pill pagination-arrow"
                  : "link-pill pagination-arrow pagination-disabled"
              }
              aria-disabled={resultsPage.page >= resultsPage.totalPages}
            >
              Next
            </Link>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
