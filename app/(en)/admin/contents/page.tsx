import Link from "next/link";
import { ReviewStatus } from "@prisma/client";
import { clearContentIssueReportsAction, deleteContentAction, reportPassedContentIssueAction } from "@/app/actions";
import { requireStaff } from "@/lib/auth/session";
import { buildContentHref } from "@/lib/content-href";
import { getAdminContentsPage } from "@/lib/content";

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
type AdminReviewFilter = "all" | "unverified" | "edited" | "passed";
type AdminPublishFilter = "all" | "compliance-rejected";

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

function buildAdminContentsHref(
  review: AdminReviewFilter,
  publish: AdminPublishFilter,
  page: number,
  pageSize: number
) {
  const params = new URLSearchParams();

  if (review !== "all") {
    params.set("review", review);
  }

  if (publish !== "all") {
    params.set("publish", publish);
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
  const staff = await requireStaff({ touchActivity: false });
  const params = await searchParams;
  const success = typeof params.success === "string" ? params.success : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;
  const review =
    typeof params.review === "string" && ["all", "unverified", "edited", "passed"].includes(params.review)
      ? (params.review as AdminReviewFilter)
      : "all";
  const publish =
    typeof params.publish === "string" && ["all", "compliance-rejected"].includes(params.publish)
      ? (params.publish as AdminPublishFilter)
      : "all";
  const pageParam = typeof params.page === "string" ? Number(params.page) : 1;
  const pageSizeParam = typeof params.pageSize === "string" ? Number(params.pageSize) : 20;
  const currentPage = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const currentPageSize = PAGE_SIZE_OPTIONS.includes(pageSizeParam as 20 | 50 | 100) ? pageSizeParam : 20;
  const { items: contents, totalPages, totalCount, reviewCounts, publishCounts } = await getAdminContentsPage({
    reviewStatus: review,
    publishStatus: publish,
    page: currentPage,
    pageSize: currentPageSize,
    viewerRole: staff.role
  });
  const redirectTo = buildAdminContentsHref(review, publish, currentPage, currentPageSize);
  const paginationItems = buildPagination(totalPages, currentPage);

  return (
    <section className="page-section panel">
      <div className="split">
        <div className="admin-contents-header">
          <div className="eyebrow">Admin Contents</div>
          <h1 className="title-lg">Manage Contents</h1>
          <div className="inline-actions">
            <Link
              href={buildAdminContentsHref("all", publish, 1, currentPageSize)}
              className={review === "all" ? "button secondary" : "link-pill"}
            >
              All
            </Link>
            <Link
              href={buildAdminContentsHref("unverified", publish, 1, currentPageSize)}
              className={review === "unverified" ? "button secondary" : "link-pill"}
            >
              Unverified
            </Link>
            <Link
              href={buildAdminContentsHref("edited", publish, 1, currentPageSize)}
              className={review === "edited" ? "button secondary" : "link-pill"}
            >
              Edited
            </Link>
            <Link
              href={buildAdminContentsHref("passed", publish, 1, currentPageSize)}
              className={review === "passed" ? "button secondary" : "link-pill"}
            >
              Passed
            </Link>
          </div>
        </div>
          <div className="admin-contents-toolbar">
            <div className="admin-contents-review-stats">
              <Link
                href={buildAdminContentsHref("unverified", publish, 1, currentPageSize)}
                className={review === "unverified" ? "admin-stat-card admin-review-stat admin-review-stat-active" : "admin-stat-card admin-review-stat"}
              >
                <span className="eyebrow">Unverified</span>
                <strong>{reviewCounts.unverified}</strong>
                <small>Waiting for audit handling</small>
              </Link>
              <Link
                href={buildAdminContentsHref("edited", publish, 1, currentPageSize)}
                className={review === "edited" ? "admin-stat-card admin-review-stat admin-review-stat-active" : "admin-stat-card admin-review-stat"}
              >
                <span className="eyebrow">Edited</span>
                <strong>{reviewCounts.edited}</strong>
                <small>Reviewed by audit staff</small>
              </Link>
              <Link
                href={buildAdminContentsHref("passed", publish, 1, currentPageSize)}
                className={review === "passed" ? "admin-stat-card admin-review-stat admin-review-stat-active" : "admin-stat-card admin-review-stat"}
              >
                <span className="eyebrow">Passed</span>
                <strong>{reviewCounts.passed}</strong>
                <small>Approved by admin</small>
              </Link>
              <Link
                href={
                  publish === "compliance-rejected"
                    ? buildAdminContentsHref(review, "all", 1, currentPageSize)
                    : buildAdminContentsHref(review, "compliance-rejected", 1, currentPageSize)
                }
                className={
                  publish === "compliance-rejected"
                    ? "admin-stat-card admin-review-stat admin-review-stat-active"
                    : "admin-stat-card admin-review-stat"
                }
              >
                <span className="eyebrow">Compliance Rejected</span>
                <strong>{publishCounts.complianceRejected}</strong>
                <small>{publish === "compliance-rejected" ? "Click to clear this filter" : "Blocked by compliance review"}</small>
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
        <p className="muted">Status rules: `PUBLISHED` is public, `SUMMIT` is visible to logged-in users, `DRAFT` stays admin-only, `COMPLIANCE_REJECTED` is blocked by compliance, and `INVISIBLE` is hidden from all frontend pages.</p>
        <div className="status">{`Page ${currentPage} / ${totalPages} - ${totalCount} posts`}</div>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Slug</th>
            <th>Status</th>
            <th>Review</th>
            <th>Reports</th>
            <th>Actions</th>
            <th>First Edited By</th>
          </tr>
        </thead>
        <tbody>
          {contents.map((content) => {
            const reviewStatusMeta = getReviewStatusMeta(content.reviewStatus);
            const displayEditedBy = content.firstEditedBy ?? content.editedBy;
            const displayEditedAt = content.firstEditedAt ?? content.editedAt;
            const totalReportCount =
              content.memberReportOriginalSourceCount + content.memberReportWebsiteDownloadCount;

            return (
              <tr key={content.id}>
                <td>
                  <Link href={buildContentHref(content.slug)} className="table-title-link">
                    {content.title}
                  </Link>
                </td>
                <td>{content.slug}</td>
                <td>{content.publishStatus}</td>
                <td>
                  <span className={reviewStatusMeta.className}>{reviewStatusMeta.label}</span>
                </td>
                <td>
                  <div className="admin-content-report-cell">
                    <span className={totalReportCount > 0 ? "status status-unverified" : "status"}>{`Total ${totalReportCount}`}</span>
                    {content.reviewStatus === ReviewStatus.PASSED ? (
                      <form action={reportPassedContentIssueAction}>
                        <input type="hidden" name="contentId" value={content.id} />
                        <input type="hidden" name="issueType" value="fileIssue" />
                        <input type="hidden" name="redirectTo" value={redirectTo} />
                        <button
                          type="submit"
                          className="link-pill"
                          title="Only use this when downloadable files or images are broken."
                        >
                          Report Issue
                        </button>
                      </form>
                    ) : (
                      <small className="muted">Reporting is only available for passed content.</small>
                    )}
                    {totalReportCount > 0 ? (
                      <form action={clearContentIssueReportsAction}>
                        <input type="hidden" name="contentId" value={content.id} />
                        <input type="hidden" name="redirectTo" value={redirectTo} />
                        <button type="submit" className="link-pill">
                          Clear Reports
                        </button>
                      </form>
                    ) : null}
                  </div>
                </td>
                <td>
                  <div className="inline-actions">
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
                <td>
                  {displayEditedBy ? (
                    <div>
                      <strong>{displayEditedBy.username ?? displayEditedBy.email}</strong>
                      {displayEditedAt ? <div className="muted">{displayEditedAt.toLocaleDateString("zh-TW")}</div> : null}
                    </div>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {totalPages > 1 ? (
        <nav className="pagination-nav" aria-label="Admin contents pagination">
          <Link
            href={buildAdminContentsHref(review, publish, currentPage > 1 ? currentPage - 1 : 1, currentPageSize)}
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
                  href={buildAdminContentsHref(review, publish, item, currentPageSize)}
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
                  href={buildAdminContentsHref(review, publish, 1, size)}
                  className={size === currentPageSize ? "button secondary pagination-page-current" : "link-pill pagination-page"}
                >
                  {size} / page
                </Link>
              ))}
            </div>
          </div>
          <Link
            href={buildAdminContentsHref(review, publish, currentPage < totalPages ? currentPage + 1 : totalPages, currentPageSize)}
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
