import Link from "next/link";
import { ReviewStatus } from "@prisma/client";
import { deleteContentAction, transitionContentReviewStatusAction } from "@/app/actions";
import { requireStaff } from "@/lib/auth/session";
import { getAdminContentReviewCounts, getAdminContents } from "@/lib/content";

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
  const [contents, reviewCounts] = await Promise.all([
    getAdminContents({ reviewStatus: review }),
    getAdminContentReviewCounts()
  ]);
  const redirectTo = review === "all" ? "/admin/contents" : `/admin/contents?review=${review}`;

  return (
    <section className="page-section panel">
      <div className="split">
        <div className="admin-contents-header">
          <div className="eyebrow">Admin Contents</div>
          <h1 className="title-lg">Manage Contents</h1>
          <div className="inline-actions">
            <Link href="/admin/contents" className={review === "all" ? "button secondary" : "link-pill"}>
              All
            </Link>
            <Link
              href="/admin/contents?review=unverified"
              className={review === "unverified" ? "button secondary" : "link-pill"}
            >
              Unverified
            </Link>
            <Link
              href="/admin/contents?review=edited"
              className={review === "edited" ? "button secondary" : "link-pill"}
            >
              Edited
            </Link>
            <Link
              href="/admin/contents?review=passed"
              className={review === "passed" ? "button secondary" : "link-pill"}
            >
              Passed
            </Link>
          </div>
        </div>
        <div className="admin-contents-toolbar">
          <div className="admin-contents-review-stats">
            <article className="admin-stat-card admin-review-stat">
              <span className="eyebrow">Unverified</span>
              <strong>{reviewCounts.unverified}</strong>
              <small>Waiting for audit handling</small>
            </article>
            <article className="admin-stat-card admin-review-stat">
              <span className="eyebrow">Edited</span>
              <strong>{reviewCounts.edited}</strong>
              <small>Reviewed by audit staff</small>
            </article>
            <article className="admin-stat-card admin-review-stat">
              <span className="eyebrow">Passed</span>
              <strong>{reviewCounts.passed}</strong>
              <small>Approved by admin</small>
            </article>
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
      <p className="muted">Status rules: `PUBLISHED` is public, `SUMMIT` is visible to logged-in users, and `DRAFT` stays in admin only.</p>
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
    </section>
  );
}
