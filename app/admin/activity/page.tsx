import Link from "next/link";
import { toggleUserSuspendedAction, updateUserRoleAction } from "@/app/actions";
import { getAccountActivityPageData, type RiskLevel } from "@/lib/admin/activity";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils";

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

function buildActivityHref(page: number, pageSize: number) {
  const params = new URLSearchParams();

  if (page > 1) {
    params.set("page", String(page));
  }

  if (pageSize !== 20) {
    params.set("pageSize", String(pageSize));
  }

  const query = params.toString();
  return query ? `/admin/activity?${query}` : "/admin/activity";
}

function getRiskClassName(riskLevel: RiskLevel) {
  switch (riskLevel) {
    case "suspended":
      return "status status-unverified";
    case "high":
      return "status admin-risk-high";
    case "elevated":
      return "status admin-risk-elevated";
    default:
      return "status status-verified";
  }
}

function getRiskLabel(riskLevel: RiskLevel) {
  switch (riskLevel) {
    case "suspended":
      return "Suspended";
    case "high":
      return "High Risk";
    case "elevated":
      return "Elevated";
    default:
      return "Normal";
  }
}

export default async function AdminActivityPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin({ touchActivity: false });
  const params = await searchParams;
  const success = typeof params.success === "string" ? params.success : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;
  const pageParam = typeof params.page === "string" ? Number(params.page) : 1;
  const pageSizeParam = typeof params.pageSize === "string" ? Number(params.pageSize) : 20;
  const currentPage = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const currentPageSize = PAGE_SIZE_OPTIONS.includes(pageSizeParam as 20 | 50 | 100) ? pageSizeParam : 20;
  const data = await getAccountActivityPageData({ page: currentPage, pageSize: currentPageSize });
  const paginationItems = buildPagination(data.totalPages, data.currentPage);
  const redirectTo = buildActivityHref(data.currentPage, data.currentPageSize);

  return (
    <div className="page-section grid admin-dashboard-grid">
      <section className="panel">
        <div className="split">
          <div>
            <div className="eyebrow">Admin Only</div>
            <h1 className="title-lg">Account Activity Details</h1>
          </div>
          <div className="inline-actions">
            <Link href="/admin" className="link-pill">
              Back to Dashboard
            </Link>
            <Link href="/admin/contents?review=unverified" className="button secondary">
              Review Unverified
            </Link>
          </div>
        </div>
        {success ? <div className="notice">{success}</div> : null}
        {error ? <div className="notice">{error}</div> : null}
        <div className="admin-stats-grid">
          <article className="admin-stat-card">
            <span className="eyebrow">Total Accounts</span>
            <strong>{data.analytics.summary.totalAccounts}</strong>
            <small>All accounts currently stored</small>
          </article>
          <article className="admin-stat-card">
            <span className="eyebrow">Members</span>
            <strong>{data.analytics.summary.totalMembers}</strong>
            <small>Standard member accounts</small>
          </article>
          <article className="admin-stat-card">
            <span className="eyebrow">Audit Staff</span>
            <strong>{data.analytics.summary.totalAuditUsers}</strong>
            <small>Accounts assigned to review work</small>
          </article>
          <article className="admin-stat-card">
            <span className="eyebrow">Admins</span>
            <strong>{data.analytics.summary.totalAdmins}</strong>
            <small>Admin accounts with final control</small>
          </article>
          <article className="admin-stat-card">
            <span className="eyebrow">Suspended</span>
            <strong>{data.analytics.summary.suspendedUsers}</strong>
            <small>Accounts currently blocked</small>
          </article>
          <article className="admin-stat-card">
            <span className="eyebrow">Suspicious 24h</span>
            <strong>{data.analytics.summary.suspiciousUsers24h}</strong>
            <small>Accounts above the high-risk threshold</small>
          </article>
          <article className="admin-stat-card">
            <span className="eyebrow">Active 24h</span>
            <strong>{data.analytics.summary.activeUsers24h}</strong>
            <small>Accounts seen in the last day</small>
          </article>
          <article className="admin-stat-card">
            <span className="eyebrow">Sign-ins 7d</span>
            <strong>{data.analytics.summary.signIns7d}</strong>
            <small>Recent successful sign-ins</small>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="split">
          <div>
            <div className="eyebrow">Accounts</div>
            <h2 className="title-lg">Risk and Suspension Control</h2>
          </div>
          <div className="status">{`Page ${data.currentPage} / ${data.totalPages} - ${data.totalCount} accounts`}</div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>ID Name</th>
              <th>Role</th>
              <th>Risk</th>
              <th>Logins 24h</th>
              <th>Last Login</th>
              <th>Last Seen</th>
              <th>Access</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.users.map((user) => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>{user.username ?? "Not set"}</td>
                <td>{user.role}</td>
                <td>
                  <span className={getRiskClassName(user.riskLevel)}>{getRiskLabel(user.riskLevel)}</span>
                </td>
                <td>{user.logins24h}</td>
                <td>{formatDateTime(user.lastLoginAt)}</td>
                <td>{formatDateTime(user.lastSeenAt)}</td>
                <td>
                  {user.role === "ADMIN" ? (
                    <span className="muted">Admin fixed</span>
                  ) : (
                    <form action={updateUserRoleAction} className="inline-actions">
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="redirectTo" value={redirectTo} />
                      <input type="hidden" name="nextRole" value={user.role === "AUDIT" ? "MEMBER" : "AUDIT"} />
                      <button type="submit" className={user.role === "AUDIT" ? "button secondary" : "link-pill"}>
                        {user.role === "AUDIT" ? "Set Member" : "Promote Audit"}
                      </button>
                    </form>
                  )}
                </td>
                <td>
                  {user.id === admin.id ? (
                    <span className="muted">Current admin</span>
                  ) : (
                    <form action={toggleUserSuspendedAction}>
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="nextValue" value={String(!user.isSuspended)} />
                      <input type="hidden" name="redirectTo" value={redirectTo} />
                      <button type="submit" className={user.isSuspended ? "button secondary" : "link-pill"}>
                        {user.isSuspended ? "Unsuspend" : "Suspend"}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.totalPages > 1 ? (
          <nav className="pagination-nav" aria-label="Account activity pagination">
            <Link
              href={buildActivityHref(data.currentPage > 1 ? data.currentPage - 1 : 1, data.currentPageSize)}
              className={data.currentPage > 1 ? "link-pill pagination-arrow" : "link-pill pagination-arrow pagination-disabled"}
              aria-disabled={data.currentPage <= 1}
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
                    href={buildActivityHref(item, data.currentPageSize)}
                    className={item === data.currentPage ? "button secondary pagination-page-current" : "link-pill pagination-page"}
                    aria-current={item === data.currentPage ? "page" : undefined}
                  >
                    {item}
                  </Link>
                )
              )}
              <div className="pagination-page-size">
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <Link
                    key={size}
                    href={buildActivityHref(1, size)}
                    className={size === data.currentPageSize ? "button secondary pagination-page-current" : "link-pill pagination-page"}
                  >
                    {size} / page
                  </Link>
                ))}
              </div>
            </div>
            <Link
              href={buildActivityHref(
                data.currentPage < data.totalPages ? data.currentPage + 1 : data.totalPages,
                data.currentPageSize
              )}
              className={data.currentPage < data.totalPages ? "link-pill pagination-arrow" : "link-pill pagination-arrow pagination-disabled"}
              aria-disabled={data.currentPage >= data.totalPages}
            >
              Next
            </Link>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
