import Link from "next/link";
import { getContentViewAnalytics } from "@/lib/content";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils";

export default async function AdminViewsPage() {
  await requireAdmin({ touchActivity: false });
  const contentViews = await getContentViewAnalytics();

  return (
    <div className="page-section grid admin-dashboard-grid">
      <section className="panel">
        <div className="split">
          <div>
            <div className="eyebrow">Admin Only</div>
            <h1 className="title-lg">Content View Details</h1>
          </div>
          <div className="inline-actions">
            <Link href="/admin" className="link-pill">
              Back to Dashboard
            </Link>
            <Link href="/admin/contents" className="button secondary">
              Manage Contents
            </Link>
          </div>
        </div>

        <div className="admin-stats-grid">
          <article className="admin-stat-card">
            <span className="eyebrow">Total Views</span>
            <strong>{contentViews.totalViews}</strong>
            <small>Total content detail page opens recorded so far</small>
          </article>
          <article className="admin-stat-card">
            <span className="eyebrow">Per-day Views</span>
            <strong>{contentViews.perDayViews}</strong>
            <small>Total content detail page opens recorded for today</small>
          </article>
          <article className="admin-stat-card">
            <span className="eyebrow">Per-month Views</span>
            <strong>{contentViews.perMonthViews}</strong>
            <small>Total content detail page opens recorded for this month</small>
          </article>
          <article className="admin-stat-card">
            <span className="eyebrow">Viewed Posts</span>
            <strong>{contentViews.viewedContents}</strong>
            <small>How many posts have at least one recorded view</small>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="eyebrow">Content Views</div>
        <h2 className="title-lg">Top Viewed Content</h2>
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
    </div>
  );
}
