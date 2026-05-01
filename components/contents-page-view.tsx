import Link from "next/link";
import { ContentCard } from "@/components/content-card";
import { HomeStickyBanner } from "@/components/home-sticky-banner";
import { getLocaleContentsHref, type UiLocale } from "@/lib/ui-locale";

type ContentsPageContent = {
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

type ContentsPageViewProps = {
  items: ContentsPageContent[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  locale: UiLocale;
  copy: {
    eyebrow: string;
    title: string;
    status: (currentPage: number, totalPages: number, totalCount: number) => string;
    previous: string;
    next: string;
    pageSummary: (pageSize: number) => string;
    paginationLabel: string;
  };
};

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

export function ContentsPageView({
  items,
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  locale,
  copy
}: ContentsPageViewProps) {
  const paginationItems = buildPagination(totalPages, currentPage);
  const contentsHref = getLocaleContentsHref(locale);

  return (
    <>
      <section className="page-section panel">
        <div className="split">
          <div>
            <div className="eyebrow">{copy.eyebrow}</div>
            <h1 className="title-lg">{copy.title}</h1>
          </div>
          <div className="status">{copy.status(currentPage, totalPages, totalCount)}</div>
        </div>
        <div className="grid content-grid">
          {items.map((content) => (
            <ContentCard key={content.id} content={content} locale={locale} />
          ))}
        </div>
        {totalPages > 1 ? (
          <nav className="pagination-nav" aria-label={copy.paginationLabel}>
            <Link
              href={currentPage > 1 ? `${contentsHref}?page=${currentPage - 1}` : `${contentsHref}?page=1`}
              className={currentPage > 1 ? "link-pill pagination-arrow" : "link-pill pagination-arrow pagination-disabled"}
              aria-disabled={currentPage <= 1}
            >
              {copy.previous}
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
                    href={item === 1 ? contentsHref : `${contentsHref}?page=${item}`}
                    className={item === currentPage ? "button secondary pagination-page-current" : "link-pill pagination-page"}
                    aria-current={item === currentPage ? "page" : undefined}
                  >
                    {item}
                  </Link>
                )
              )}
              <span className="pagination-summary">{copy.pageSummary(pageSize)}</span>
            </div>
            <Link
              href={currentPage < totalPages ? `${contentsHref}?page=${currentPage + 1}` : `${contentsHref}?page=${totalPages}`}
              className={currentPage < totalPages ? "link-pill pagination-arrow" : "link-pill pagination-arrow pagination-disabled"}
              aria-disabled={currentPage >= totalPages}
            >
              {copy.next}
            </Link>
          </nav>
        ) : null}
      </section>
      <HomeStickyBanner />
    </>
  );
}
