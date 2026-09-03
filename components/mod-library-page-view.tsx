import Link from "next/link";
import { HomeStickyBanner } from "@/components/home-sticky-banner";
import { ModLibrarySearchForm } from "@/components/mod-library-search-form";
import type { UiLocale } from "@/lib/ui-locale";
import { getLocaleModLibraryHref } from "@/lib/ui-locale";

type ModLibraryPageItem = {
  id: number;
  name: string;
  version: string;
  author: string;
  guid: string;
  filename: string;
  messageLink: string;
};

type ModLibraryPageCopy = {
  eyebrow: string;
  title: string;
  description: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchButton: string;
  clearButton: string;
  statusReady: string;
  statusDemo: string;
  empty: string;
  fields: {
    name: string;
    version: string;
    author: string;
    guid: string;
    filename: string;
    messageLink: string;
  };
  paginationLabel: string;
  previous: string;
  next: string;
};

type ModLibraryPageViewProps = {
  locale: UiLocale;
  copy: ModLibraryPageCopy;
  items: ModLibraryPageItem[];
  query: string;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  databaseReady: boolean;
};

function buildPageHref(basePath: string, query: string, page: number, pageSize: number) {
  const params = new URLSearchParams();
  if (query) {
    params.set("q", query);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  if (pageSize !== 50) {
    params.set("pageSize", String(pageSize));
  }
  const serialized = params.toString();
  return serialized ? `${basePath}?${serialized}` : basePath;
}

export function ModLibraryPageView({
  locale,
  copy,
  items,
  query,
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  databaseReady
}: ModLibraryPageViewProps) {
  const basePath = getLocaleModLibraryHref(locale);
  const prevPage = currentPage > 1 ? currentPage - 1 : 1;
  const nextPage = currentPage < totalPages ? currentPage + 1 : totalPages;

  return (
    <div className="page-section grid">
      <section className="panel">
        <div className="eyebrow">{copy.eyebrow}</div>
        <h1 className="title-lg">{copy.title}</h1>
        <p className="muted">{copy.description}</p>

        <ModLibrarySearchForm
          action={basePath}
          query={query}
          pageSize={pageSize}
          searchLabel={copy.searchLabel}
          searchPlaceholder={copy.searchPlaceholder}
          searchButton={copy.searchButton}
          clearButton={copy.clearButton}
        />

        <div className="split mod-library-toolbar">
          <span className="status">{`Page ${currentPage} / ${totalPages} - ${totalCount} mods`}</span>
          <span className="status-pill">{databaseReady ? copy.statusReady : copy.statusDemo}</span>
        </div>

        <div className="mod-library-list">
          {items.map((item) => (
            <article
              key={`mod-item-${item.id}`}
              className={item.messageLink ? "mod-library-item mod-library-item-clickable" : "mod-library-item"}
            >
              {item.messageLink ? (
                <a href={item.messageLink} className="mod-library-item-link">
                  <div className="mod-library-item-grid">
                    <div>
                      <span className="eyebrow">{copy.fields.name}</span>
                      <strong>{item.name}</strong>
                    </div>
                    <div>
                      <span className="eyebrow">{copy.fields.version}</span>
                      <span>{item.version || "-"}</span>
                    </div>
                    <div>
                      <span className="eyebrow">{copy.fields.author}</span>
                      <span>{item.author || "-"}</span>
                    </div>
                    <div>
                      <span className="eyebrow">{copy.fields.guid}</span>
                      <code>{item.guid}</code>
                    </div>
                    <div>
                      <span className="eyebrow">{copy.fields.filename}</span>
                      <span>{item.filename}</span>
                    </div>
                  </div>
                </a>
              ) : (
                <div className="mod-library-item-grid">
                  <div>
                    <span className="eyebrow">{copy.fields.name}</span>
                    <strong>{item.name}</strong>
                  </div>
                  <div>
                    <span className="eyebrow">{copy.fields.version}</span>
                    <span>{item.version || "-"}</span>
                  </div>
                  <div>
                    <span className="eyebrow">{copy.fields.author}</span>
                    <span>{item.author || "-"}</span>
                  </div>
                  <div>
                    <span className="eyebrow">{copy.fields.guid}</span>
                    <code>{item.guid}</code>
                  </div>
                  <div>
                    <span className="eyebrow">{copy.fields.filename}</span>
                    <span>{item.filename}</span>
                  </div>
                </div>
              )}
            </article>
          ))}
          {!items.length ? <div className="muted">{copy.empty}</div> : null}
        </div>

        {totalPages > 1 ? (
          <nav className="pagination-nav" aria-label={copy.paginationLabel}>
            <Link
              href={buildPageHref(basePath, query, prevPage, pageSize)}
              className={currentPage > 1 ? "link-pill pagination-arrow" : "link-pill pagination-arrow pagination-disabled"}
              aria-disabled={currentPage <= 1}
            >
              {copy.previous}
            </Link>
            <span className="pagination-ellipsis">{` ${currentPage} / ${totalPages} `}</span>
            <Link
              href={buildPageHref(basePath, query, nextPage, pageSize)}
              className={currentPage < totalPages ? "link-pill pagination-arrow" : "link-pill pagination-arrow pagination-disabled"}
              aria-disabled={currentPage >= totalPages}
            >
              {copy.next}
            </Link>
          </nav>
        ) : null}
      </section>
      <HomeStickyBanner />
    </div>
  );
}
