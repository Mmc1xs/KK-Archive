import Link from "next/link";
import { getAccountActivityAnalytics } from "@/lib/admin/activity";
import { requireStaff } from "@/lib/auth/session";
import { getContentViewAnalytics } from "@/lib/content";
import { formatDateTime } from "@/lib/utils";

export default async function AdminPage() {
  const user = await requireStaff();
  const isAdmin = user.role === "ADMIN";
  const [analytics, contentViews] = isAdmin
    ? await Promise.all([getAccountActivityAnalytics(), getContentViewAnalytics()])
    : [null, null];

  return (
    <div className="page-section grid admin-dashboard-grid">
      <section className="panel">
        <div className="eyebrow">{isAdmin ? "Admin Only" : "Audit Workspace"}</div>
        <h1 className="title-lg">{isAdmin ? "Admin Dashboard" : "Audit Dashboard"}</h1>
        <p className="muted">Signed in as {user.username ?? user.email}</p>
        <div className="inline-actions">
          <Link href="/admin/contents" className="button">
            {isAdmin ? "Manage Contents" : "Review Contents"}
          </Link>
          {isAdmin ? (
            <>
              <Link href="/admin/activity" className="button secondary">
                Account Activity
              </Link>
              <Link href="/admin/tags" className="link-pill">
                Manage Tags
              </Link>
            </>
          ) : null}
        </div>
      </section>

      {isAdmin && analytics && contentViews ? (
        <>
          <section className="panel">
            <div className="split">
              <div>
                <div className="eyebrow">Account Activity</div>
                <h2 className="title-lg">Member Activity Signals</h2>
              </div>
              <div className="inline-actions">
                <div className="status status-unverified">{analytics.summary.suspiciousUsers24h} suspicious in 24h</div>
                <div className="status">{analytics.summary.suspendedUsers} suspended</div>
              </div>
            </div>

            <div className="admin-stats-grid">
              <article className="admin-stat-card">
                <span className="eyebrow">Members</span>
                <strong>{analytics.summary.totalMembers}</strong>
                <small>Total member accounts</small>
              </article>
              <article className="admin-stat-card">
                <span className="eyebrow">Active 24h</span>
                <strong>{analytics.summary.activeUsers24h}</strong>
                <small>Accounts seen in the last 24 hours</small>
              </article>
              <article className="admin-stat-card">
                <span className="eyebrow">Sign-ins 24h</span>
                <strong>{analytics.summary.signIns24h}</strong>
                <small>Successful member logins in the last day</small>
              </article>
              <article className="admin-stat-card">
                <span className="eyebrow">Sign-ins 7d</span>
                <strong>{analytics.summary.signIns7d}</strong>
                <small>Successful member logins in the last 7 days</small>
              </article>
            </div>

            <div className="admin-dashboard-columns">
              <section className="tag-section">
                <strong>Top Active Accounts</strong>
                <div className="grid">
                  {analytics.topActiveUsers.length ? (
                    analytics.topActiveUsers.map((account) => (
                      <article key={account.id} className="admin-activity-card">
                        <div className="split">
                          <div>
                            <strong>{account.username ?? account.email}</strong>
                            <div className="muted">{`${account.email} - ${account.role}`}</div>
                          </div>
                          <div className={account.logins24h >= 15 ? "status status-unverified" : "status"}>
                            {account.logins24h} sign-ins / 24h
                          </div>
                        </div>
                        <div className="admin-activity-meta">
                          <span>Total logins: {account.loginCount}</span>
                          <span>Last login: {formatDateTime(account.lastLoginAt)}</span>
                          <span>Last seen: {formatDateTime(account.lastSeenAt)}</span>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="admin-activity-card muted">No member activity has been recorded yet.</div>
                  )}
                </div>
              </section>

              <section className="tag-section">
                <strong>Recent Sign-ins</strong>
                <div className="grid">
                  {analytics.recentSignIns.length ? (
                    analytics.recentSignIns.map((event) => (
                      <article key={event.id} className="admin-activity-card">
                        <div className="split">
                          <strong>{event.username ?? event.email}</strong>
                          <span className="status">{event.provider}</span>
                        </div>
                        <div className="admin-activity-meta">
                          <span>{`${event.email} - ${event.role}`}</span>
                          <span>{formatDateTime(event.createdAt)}</span>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="admin-activity-card muted">No sign-ins have been recorded yet.</div>
                  )}
                </div>
              </section>
            </div>
          </section>

          <section className="panel">
            <div className="split">
              <div>
                <div className="eyebrow">Content Views</div>
                <h2 className="title-lg">Simple View Counts</h2>
              </div>
              <div className="inline-actions">
                <div className="status">{contentViews.totalViews} total views</div>
              </div>
            </div>

            <div className="admin-stats-grid">
              <article className="admin-stat-card">
                <span className="eyebrow">Total Views</span>
                <strong>{contentViews.totalViews}</strong>
                <small>Total content detail page opens recorded so far</small>
              </article>
              <article className="admin-stat-card">
                <span className="eyebrow">Viewed Posts</span>
                <strong>{contentViews.viewedContents}</strong>
                <small>How many posts have at least one recorded view</small>
              </article>
            </div>

            <section className="tag-section">
              <strong>Top Viewed Content</strong>
              <div className="grid">
                {contentViews.topViewedContents.length ? (
                  contentViews.topViewedContents.map((content) => (
                    <article key={content.id} className="admin-activity-card">
                      <div className="split">
                        <div>
                          <strong>{content.title}</strong>
                          <div className="muted">{`${content.slug} - ${content.publishStatus}`}</div>
                        </div>
                        <div className="status">{content.viewCount} views</div>
                      </div>
                      <div className="admin-activity-meta">
                        <span>Last viewed: {formatDateTime(content.lastViewedAt)}</span>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="admin-activity-card muted">No content views have been recorded yet.</div>
                )}
              </div>
            </section>
          </section>
        </>
      ) : (
        <section className="panel">
          <div className="eyebrow">Review Workflow</div>
          <h2 className="title-lg">Audit Review Queue</h2>
          <p className="muted">
            Audit accounts can review tag quality, edit content metadata, and move posts from Unverified to Edited.
            Final approval to Passed remains an admin-only step.
          </p>
          <div className="inline-actions">
            <Link href="/admin/contents?review=unverified" className="button secondary">
              Review Unverified
            </Link>
            <Link href="/admin/contents?review=edited" className="link-pill">
              View Edited
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
