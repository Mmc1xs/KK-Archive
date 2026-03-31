import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";

export default async function AdminPage() {
  const user = await requireStaff({ touchActivity: false });
  const isAdmin = user.role === "ADMIN";

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
          <Link href="/admin/views" className="button secondary">
            Content Views
          </Link>
          {isAdmin ? (
            <>
              <Link href="/admin/site-download-demo" className="button secondary">
                Site Download Demo
              </Link>
              <Link href="/admin/homepage" className="button secondary">
                Homepage
              </Link>
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

      {isAdmin ? (
        <>
          <section className="panel">
            <div className="eyebrow">Admin Overview</div>
            <h2 className="title-lg">Choose a management area</h2>
            <p className="muted">
              Use Manage Contents for review work, Account Activity for member risk signals, and Content Views for
              basic traffic reporting.
            </p>
            <div className="inline-actions">
              <Link href="/admin/contents?review=unverified" className="button secondary">
                Review Unverified
              </Link>
              <Link href="/admin/site-download-demo" className="link-pill">
                Open Site Download Demo
              </Link>
              <Link href="/admin/activity" className="link-pill">
                Open Activity Details
              </Link>
              <Link href="/admin/homepage" className="link-pill">
                Manage Hot Topic
              </Link>
              <Link href="/admin/views" className="link-pill">
                Open View Reports
              </Link>
            </div>
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
            <Link href="/admin/views" className="link-pill">
              Open View Reports
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
