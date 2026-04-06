import Link from "next/link";
import { ContentCard } from "@/components/content-card";
import { SearchFilters, type SearchFiltersLabels } from "@/components/search-filters";
import { getLocaleSearchHref, type UiLocale } from "@/lib/ui-locale";

type SearchTagOption = {
  id: number;
  name: string;
  slug: string;
};

type SearchResultContent = {
  id: number;
  title: string;
  slug: string;
  description: string;
  coverImageUrl: string;
  reviewStatus: "UNVERIFIED" | "EDITED" | "PASSED";
  contentTags: Array<{
    tag: {
      name: string;
      type: string;
      slug: string;
    };
  }>;
};

type SearchPageViewProps = {
  locale: UiLocale;
  types: SearchTagOption[];
  initialAuthor?: SearchTagOption | null;
  initialWork?: SearchTagOption | null;
  initialCharacter?: SearchTagOption | null;
  initialStyles: SearchTagOption[];
  initialUsages: SearchTagOption[];
  initialTypes: string[];
  resultsPage: {
    page: number;
    pageSize: number;
    items: SearchResultContent[];
    hasPrevious: boolean;
    hasNext: boolean;
  };
  filters: {
    author?: string;
    work?: string;
    character?: string;
    styles: string[];
    usages: string[];
    types: string[];
  };
  copy: {
    filtersEyebrow: string;
    filtersTitle: string;
    resultsEyebrow: string;
    resultsTitle: string;
    status: (page: number, shownCount: number) => string;
    previous: string;
    next: string;
    pageCurrent: (page: number) => string;
    pageSummary: (pageSize: number) => string;
    paginationLabel: string;
    filterLabels: SearchFiltersLabels;
  };
};

function buildSearchHref(locale: UiLocale, options: {
  page: number;
  author?: string;
  work?: string;
  character?: string;
  styles: string[];
  usages: string[];
  types: string[];
}) {
  const params = new URLSearchParams();

  if (options.author) {
    params.set("author", options.author);
  }
  if (options.work) {
    params.set("work", options.work);
  }
  if (options.character) {
    params.set("character", options.character);
  }

  options.styles.forEach((slug) => params.append("styles", slug));
  options.usages.forEach((slug) => params.append("usages", slug));
  options.types.forEach((slug) => params.append("types", slug));

  if (options.page > 1) {
    params.set("page", String(options.page));
  }

  const query = params.toString();
  const baseHref = getLocaleSearchHref(locale);
  return query ? `${baseHref}?${query}` : baseHref;
}

export function SearchPageView({
  locale,
  types,
  initialAuthor,
  initialWork,
  initialCharacter,
  initialStyles,
  initialUsages,
  initialTypes,
  resultsPage,
  filters,
  copy
}: SearchPageViewProps) {
  const searchHref = getLocaleSearchHref(locale);

  return (
    <div className="page-section search-layout">
      <aside className="panel search-filters-panel">
        <div className="eyebrow">{copy.filtersEyebrow}</div>
        <h1 className="title-lg">{copy.filtersTitle}</h1>
        <SearchFilters
          types={types}
          initialAuthor={initialAuthor}
          initialWork={initialWork}
          initialCharacter={initialCharacter}
          initialStyles={initialStyles}
          initialUsages={initialUsages}
          initialTypes={initialTypes}
          labels={copy.filterLabels}
          clearHref={searchHref}
        />
      </aside>

      <section className="panel search-results-panel">
        <div className="split">
          <div>
            <div className="eyebrow">{copy.resultsEyebrow}</div>
            <h2 className="title-lg">{copy.resultsTitle}</h2>
          </div>
          <span className="status">{copy.status(resultsPage.page, resultsPage.items.length)}</span>
        </div>

        <div className="grid content-grid search-results-grid">
          {resultsPage.items.map((content) => (
            <ContentCard key={content.id} content={content} locale={locale} />
          ))}
        </div>

        {resultsPage.hasPrevious || resultsPage.hasNext ? (
          <nav className="pagination-nav" aria-label={copy.paginationLabel}>
            <Link
              href={buildSearchHref(locale, {
                page: resultsPage.hasPrevious ? resultsPage.page - 1 : 1,
                ...filters
              })}
              className={
                resultsPage.hasPrevious ? "link-pill pagination-arrow" : "link-pill pagination-arrow pagination-disabled"
              }
              aria-disabled={!resultsPage.hasPrevious}
            >
              {copy.previous}
            </Link>
            <div className="pagination-pages">
              <span className="button secondary pagination-page-current" aria-current="page">
                {copy.pageCurrent(resultsPage.page)}
              </span>
              <span className="pagination-summary">{copy.pageSummary(resultsPage.pageSize)}</span>
            </div>
            <Link
              href={buildSearchHref(locale, {
                page: resultsPage.hasNext ? resultsPage.page + 1 : resultsPage.page,
                ...filters
              })}
              className={
                resultsPage.hasNext
                  ? "link-pill pagination-arrow"
                  : "link-pill pagination-arrow pagination-disabled"
              }
              aria-disabled={!resultsPage.hasNext}
            >
              {copy.next}
            </Link>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
