import Link from "next/link";
import { SiteDownloadDemoStatus } from "@prisma/client";
import { OpenDemoTabsLauncherButton } from "@/components/admin/open-demo-tabs-launcher-button";
import { requireAdmin } from "@/lib/auth/session";
import { getSiteDownloadDemoQueuePage } from "@/lib/demo/site-download";
import { listSiteDownloadDemoBackgroundUploadStatuses } from "@/lib/demo/site-download-background-queue";

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

function buildQueueHref(page: number, pageSize: number) {
  const params = new URLSearchParams();

  if (page > 1) {
    params.set("page", String(page));
  }

  if (pageSize !== 20) {
    params.set("pageSize", String(pageSize));
  }

  const query = params.toString();
  return query ? `/admin/site-download-demo?${query}` : "/admin/site-download-demo";
}

function getStatusClassName(status: SiteDownloadDemoStatus | null | undefined) {
  switch (status) {
    case SiteDownloadDemoStatus.FAILED:
      return "status status-unverified";
    default:
      return "status";
  }
}

function getStatusLabel(status: SiteDownloadDemoStatus | null | undefined) {
  switch (status) {
    case SiteDownloadDemoStatus.FAILED:
      return "Failed";
    default:
      return "Pending";
  }
}

export default async function AdminSiteDownloadDemoPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin({ touchActivity: false });
  const params = await searchParams;
  const pageParam = typeof params.page === "string" ? Number(params.page) : 1;
  const pageSizeParam = typeof params.pageSize === "string" ? Number(params.pageSize) : 20;
  const success = typeof params.success === "string" ? params.success : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;
  const currentPage = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const currentPageSize = PAGE_SIZE_OPTIONS.includes(pageSizeParam as 20 | 50 | 100) ? pageSizeParam : 20;
  const queue = await getSiteDownloadDemoQueuePage({
    page: currentPage,
    pageSize: currentPageSize
  });
  const backgroundStatuses = listSiteDownloadDemoBackgroundUploadStatuses();
  const paginationItems = buildPagination(queue.totalPages, queue.page);
  const currentPageDemoItems = queue.items.map((content) => ({
    href: `/admin/site-download-demo/${content.id}`,
    title: content.title || `Post ${content.id}`
  }));

  return (
    <div className="page-section grid admin-dashboard-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow">Admin Only</div>
            <h1 className="title-lg">Site Download Demo Queue</h1>
            <p className="muted">
              Process content that still has a TG download source but does not yet have a website download file.
            </p>
          </div>
          <div className="inline-actions">
            <Link href="/admin" className="button secondary">
              Back to Dashboard
            </Link>
            <Link href="/admin/contents?review=edited" className="link-pill">
              Open Reviewed Contents
            </Link>
          </div>
        </div>

        {success ? <div className="notice success">{success}</div> : null}
        {error ? <div className="notice error">{error}</div> : null}

        <div className="admin-stats-grid">
          <article className="admin-stat-card">
            <span className="eyebrow">Queue Size</span>
            <strong>{queue.totalCount}</strong>
            <small>Contents waiting for the demo workflow</small>
          </article>
          <article className="admin-stat-card">
            <span className="eyebrow">Page</span>
            <strong>{queue.page}</strong>
            <small>{`${queue.pageSize} items per page`}</small>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="split">
          <div>
            <div className="eyebrow">Pending Items</div>
            <h2 className="title-lg">TG to R2 Demo</h2>
          </div>
          <div className="inline-actions">
            <OpenDemoTabsLauncherButton items={currentPageDemoItems} />
            <div className="status">{`Page ${queue.page} / ${queue.totalPages}`}</div>
          </div>
        </div>

        {queue.items.length ? (
          <div className="grid">
            {queue.items.map((content) => {
              const backgroundStatus = backgroundStatuses.get(content.id);
              const backgroundStatusLabel =
                backgroundStatus?.stage === "queued"
                  ? "Queued"
                  : backgroundStatus?.stage === "uploading"
                    ? "Uploading"
                    : backgroundStatus?.stage === "finalizing"
                      ? "Finalizing"
                      : backgroundStatus?.stage === "completed"
                        ? "Completed"
                        : backgroundStatus?.stage === "failed"
                          ? "Failed"
                          : null;

              return (
                <article key={content.id} className="admin-activity-card">
                <div className="split">
                  <div>
                    <strong>{content.title}</strong>
                    <div className="muted">{`${content.slug} | ${content.publishStatus} | ${content.reviewStatus}`}</div>
                    <small>{content.telegramSourceUrl}</small>
                    {backgroundStatusLabel ? <div className="muted">{`Background upload: ${backgroundStatusLabel}`}</div> : null}
                  </div>
                  <span className={getStatusClassName(content.siteDownloadDemo?.status)}>
                    {backgroundStatusLabel ?? getStatusLabel(content.siteDownloadDemo?.status)}
                  </span>
                </div>

                {content.siteDownloadDemo?.errorMessage ? (
                  <div className="notice error" style={{ marginTop: 12 }}>
                    {content.siteDownloadDemo.errorMessage}
                  </div>
                ) : null}

                <div className="inline-actions" style={{ marginTop: 12 }}>
                  <Link href={`/admin/site-download-demo/${content.id}`} className="button secondary">
                    Open Demo
                  </Link>
                  <Link href={`/admin/contents/${content.id}/edit`} className="link-pill">
                    Edit Content
                  </Link>
                </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="notice">No pending content currently needs the site download demo workflow.</div>
        )}

        {queue.totalPages > 1 ? (
          <nav className="pagination-nav" aria-label="Site download demo pagination">
            <Link
              href={buildQueueHref(queue.page > 1 ? queue.page - 1 : 1, queue.pageSize)}
              className={queue.page > 1 ? "link-pill pagination-arrow" : "link-pill pagination-arrow pagination-disabled"}
              aria-disabled={queue.page <= 1}
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
                    href={buildQueueHref(item, queue.pageSize)}
                    className={item === queue.page ? "button secondary pagination-page-current" : "link-pill pagination-page"}
                    aria-current={item === queue.page ? "page" : undefined}
                  >
                    {item}
                  </Link>
                )
              )}
              <div className="pagination-page-size">
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <Link
                    key={size}
                    href={buildQueueHref(1, size)}
                    className={size === queue.pageSize ? "button secondary pagination-page-current" : "link-pill pagination-page"}
                  >
                    {size} / page
                  </Link>
                ))}
              </div>
            </div>
            <Link
              href={buildQueueHref(queue.page < queue.totalPages ? queue.page + 1 : queue.totalPages, queue.pageSize)}
              className={
                queue.page < queue.totalPages ? "link-pill pagination-arrow" : "link-pill pagination-arrow pagination-disabled"
              }
              aria-disabled={queue.page >= queue.totalPages}
            >
              Next
            </Link>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
