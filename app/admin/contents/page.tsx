import Link from "next/link";
import { ReviewStatus } from "@prisma/client";
import { deleteContentAction, transitionContentReviewStatusAction } from "@/app/actions";
import { requireStaff } from "@/lib/auth/session";
import { getAdminContentReviewCounts, getAdminContentsPage } from "@/lib/content";

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

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

function buildAdminContentsHref(review: "all" | "unverified" | "edited" | "passed", page: number, pageSize: number) {
  const params = new URLSearchParams();

  if (review !== "all") {
    params.set("review", review);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  if (pageSize !== 20) {
    params.set("pageSize", String(pageSize));
  }

  const query = params.toString();
  return query ? `/admin/contents?${query}` : "/admin/contents";
}

function getReviewStatusMeta(reviewStatus: ReviewStatus) {
  switch (reviewStatus) {
    case ReviewStatus.EDITED:
      return { label: "Edited", className: "status status-edited" };
    case ReviewStatus.PASSED:
      return { label: "Passed", className: "status status-passed" };
    default:
      return { label: "Unverified", className: "status status-unverified" };
  }
}

export default async function AdminContentsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const staff = await requireStaff();
  const params = await searchParams;
  const success = typeof params.success === "string" ? params.success : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;
  const review =
    typeof params.review === "string" && ["all", "unverified", "edited", "passed"].includes(params.review)
      ? (params.review as "all" | "unverified" | "edited" | "passed")
      : "all";
  const pageParam = typeof params.page === "string" ? Number(params.page) : 1;
  const pageSizeParam = typeof params.pageSize === "string" ? Number(params.pageSize) : 20;
  const currentPage = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const currentPageSize = PAGE_SIZE_OPTIONS.includes(pageSizeParam as 20 | 50 | 100) ? pageSizeParam : 20;
  const [{ items: contents, totalPages, totalCount }, reviewCounts] = await Promise.all([
    getAdminContentsPage({ reviewStatus: review, page: currentPage, pageSize: currentPageSize }),
    getAdminContentReviewCounts()
  ]);
  const redirectTo = buildAdminContentsHref(review, currentPage, currentPageSize);
  const paginationItems = buildPagination(totalPages, currentPage);

  return (
    <section className="page-section panel">
      <div className="split">
        <div className="admin-contents-header">
          <div className="eyebrow">Admin Contents</div>
          <h1 className="title-lg">Manage Contents</h1>
          <div className="inline-actions">
            <Link href={buildAdminContentsHref("all", 1, currentPageSize)} className={review === "all" ? "button secondary" : "link-pill"}>
              All
            </Link>
            <Link
              href={buildAdminContentsHref("unverified", 1, currentPageSize)}
              className={review === "unverified" ? "button secondary" : "link-pill"}
            >
              Unverified
            </Link>
            <Link
              href={buildAdminContentsHref("edited", 1, currentPageSize)}
              className={review === "edited" ? "button secondary" : "link-pill"}
            >
              Edited
            </Link>
            <Link
              href={buildAdminContentsHref("passed", 1, currentPageSize)}
              className={review === "passed" ? "button secondary" : "link-pill"}
            >
              Passed
            </Link>
          </div>
        </div>
          <div className="admin-contents-toolbar">
            <div className="admin-contents-review-stats">
              <Link
                href="/admin/contents?review=unverified"
                className={review === "unverified" ? "admin-stat-card admin-review-stat admin-review-stat-active" : "admin-stat-card admin-review-stat"}
              >
                <span className="eyebrow">Unverified</span>
                <strong>{reviewCounts.unverified}</strong>
                <small>Waiting for audit handling</small>
              </Link>
              <Link
                href="/admin/contents?review=edited"
                className={review === "edited" ? "admin-stat-card admin-review-stat admin-review-stat-active" : "admin-stat-card admin-review-stat"}
              >
                <span className="eyebrow">Edited</span>
                <strong>{reviewCounts.edited}</strong>
                <small>Reviewed by audit staff</small>
              </Link>
              <Link
                href="/admin/contents?review=passed"
                className={review === "passed" ? "admin-stat-card admin-review-stat admin-review-stat-active" : "admin-stat-card admin-review-stat"}
              >
                <span className="eyebrow">Passed</span>
                <strong>{reviewCounts.passed}</strong>
                <small>Approved by admin</small>
              </Link>
            </div>
        {staff.role === "ADMIN" ? (
          <Link href="/admin/contents/new" className="button">
            New Content
          </Link>
        ) : null}
        </div>
      </div>
      {success ? <div className="notice">{success}</div> : null}
      {error ? <div className="notice">{error}</div> : null}
      <div className="split">
        <p className="muted">Status rules: `PUBLISHED` is public, `SUMMIT` is visible to logged-in users, and `DRAFT` stays in admin only.</p>
        <div className="status">{`Page ${currentPage} / ${totalPages} - ${totalCount} posts`}</div>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Slug</th>
            <th>Status</th>
            <th>Review</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {contents.map((content) => {
            const reviewStatusMeta = getReviewStatusMeta(content.reviewStatus);

            return (
              <tr key={content.id}>
                <td>
                  <Link href={`/contents/${content.slug}`} className="table-title-link">
                    {content.title}
                  </Link>
                </td>
                <td>{content.slug}</td>
                <td>{content.publishStatus}</td>
                <td>
                  <span className={reviewStatusMeta.className}>{reviewStatusMeta.label}</span>
                </td>
                <td>
                  <div className="inline-actions">
                    {staff.role === "ADMIN" && content.reviewStatus !== ReviewStatus.UNVERIFIED ? (
                      <form action={transitionContentReviewStatusAction}>
                        <input type="hidden" name="contentId" value={content.id} />
                        <input type="hidden" name="nextStatus" value={ReviewStatus.UNVERIFIED} />
                        <input type="hidden" name="redirectTo" value={redirectTo} />
                        <button type="submit" className="link-pill">
                          Reset
                        </button>
                      </form>
                    ) : null}
                    <Link href={`/admin/contents/${content.id}/edit`} className="link-pill">
                      Edit
                    </Link>
                    {staff.role === "ADMIN" ? (
                      <form action={deleteContentAction}>
                        <input type="hidden" name="contentId" value={content.id} />
                        <button type="submit">Delete</button>
                      </form>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {totalPages > 1 ? (
        <nav className="pagination-nav" aria-label="Admin contents pagination">
          <Link
            href={buildAdminContentsHref(review, currentPage > 1 ? currentPage - 1 : 1, currentPageSize)}
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
                  href={buildAdminContentsHref(review, item, currentPageSize)}
                  className={item === currentPage ? "button secondary pagination-page-current" : "link-pill pagination-page"}
                  aria-current={item === currentPage ? "page" : undefined}
                >
                  {item}
                </Link>
              )
            )}
            <div className="pagination-page-size">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <Link
                  key={size}
                  href={buildAdminContentsHref(review, 1, size)}
                  className={size === currentPageSize ? "button secondary pagination-page-current" : "link-pill pagination-page"}
                >
                  {size} / page
                </Link>
              ))}
            </div>
          </div>
          <Link
            href={buildAdminContentsHref(review, currentPage < totalPages ? currentPage + 1 : totalPages, currentPageSize)}
            className={currentPage < totalPages ? "link-pill pagination-arrow" : "link-pill pagination-arrow pagination-disabled"}
            aria-disabled={currentPage >= totalPages}
          >
            Next
          </Link>
        </nav>
      ) : null}
    </section>
  );
}
