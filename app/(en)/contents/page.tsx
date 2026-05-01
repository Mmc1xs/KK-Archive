import type { Metadata } from "next";
import Link from "next/link";
import { ContentCard } from "@/components/content-card";
import { HomeStickyBanner } from "@/components/home-sticky-banner";
import { getCurrentSession } from "@/lib/auth/session";
import { getBrowsableContentsPage } from "@/lib/content";

const PAGE_SIZE = 12;
export const preferredRegion = "hkg1";

export const metadata: Metadata = {
  title: "Browse Koikatsu Cards and Presets | Koikatsu Card Archive",
  description:
    "Explore published Koikatsu cards, presets, scenes, textures, overlays, and shared resources in one searchable archive."
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

export default async function ContentsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentSession({ touchActivity: false });
  const pageParam = typeof params.page === "string" ? Number(params.page) : 1;
  const currentPage = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const { items, totalPages, totalCount } = await getBrowsableContentsPage(
    Boolean(user),
    currentPage,
    PAGE_SIZE,
    user?.role
  );
  const paginationItems = buildPagination(totalPages, currentPage);

  return (
    <>
      <section className="page-section panel">
        <div className="split">
          <div>
            <div className="eyebrow">Browsable Library</div>
            <h1 className="title-lg">Available Content</h1>
          </div>
          <div className="status">{`Page ${currentPage} / ${totalPages} - ${totalCount} posts`}</div>
        </div>
        <div className="grid content-grid">
          {items.map((content) => (
            <ContentCard key={content.id} content={content} />
          ))}
        </div>
        {totalPages > 1 ? (
          <nav className="pagination-nav" aria-label="Contents pagination">
            <Link
              href={currentPage > 1 ? `/contents?page=${currentPage - 1}` : "/contents?page=1"}
              className={currentPage > 1 ? "link-pill pagination-arrow" : "link-pill pagination-arrow pagination-disabled"}
              aria-disabled={currentPage <= 1}
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
                    href={item === 1 ? "/contents" : `/contents?page=${item}`}
                    className={item === currentPage ? "button secondary pagination-page-current" : "link-pill pagination-page"}
                    aria-current={item === currentPage ? "page" : undefined}
                  >
                    {item}
                  </Link>
                )
              )}
              <span className="pagination-summary">{PAGE_SIZE} / page</span>
            </div>
            <Link
              href={currentPage < totalPages ? `/contents?page=${currentPage + 1}` : `/contents?page=${totalPages}`}
              className={currentPage < totalPages ? "link-pill pagination-arrow" : "link-pill pagination-arrow pagination-disabled"}
              aria-disabled={currentPage >= totalPages}
            >
              Next
            </Link>
          </nav>
        ) : null}
      </section>
      <HomeStickyBanner />
    </>
  );
}
