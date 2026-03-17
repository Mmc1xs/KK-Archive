import Link from "next/link";
import { toggleUserSuspendedAction, updateUserRoleAction } from "@/app/actions";
import { getAccountActivityPageData, type RiskLevel } from "@/lib/admin/activity";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils";

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
  const [params, data] = await Promise.all([searchParams, getAccountActivityPageData()]);
  const success = typeof params.success === "string" ? params.success : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;

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
          <p className="muted">High activity accounts can be suspended directly from this table.</p>
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
                      <input type="hidden" name="redirectTo" value="/admin/activity" />
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
                      <input type="hidden" name="redirectTo" value="/admin/activity" />
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
      </section>

      <section className="panel">
        <div className="eyebrow">Recent Events</div>
        <h2 className="title-lg">Recent Sign-ins</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>ID Name</th>
              <th>Role</th>
              <th>Provider</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {data.events.map((event) => (
              <tr key={event.id}>
                <td>{event.email}</td>
                <td>{event.username ?? "Not set"}</td>
                <td>{event.role}</td>
                <td>{event.provider}</td>
                <td>{formatDateTime(event.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
