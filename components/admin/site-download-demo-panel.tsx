import Link from "next/link";
import { SiteDownloadDemoStatus } from "@prisma/client";
import { completeSiteDownloadDemoAction, ignoreSiteDownloadDemoAction } from "@/app/actions";
import { SiteDownloadDemoUploader } from "@/components/admin/site-download-demo-uploader";
import { type TelegramInspectSourceResult } from "@/lib/demo/telegram-bridge";
import { buildContentHref } from "@/lib/content-href";
import { formatDateTime } from "@/lib/utils";

type SiteDownloadDemoPanelProps = {
  content: {
    id: number;
    title: string;
    slug: string;
    publishStatus: string;
    reviewStatus: string;
    telegramSourceUrl: string | null;
    hostedFiles: Array<{
      id: number;
      fileName: string;
      objectKey: string;
      mimeType: string;
      byteSize: number;
      createdAt: Date;
    }>;
    siteDownloadDemo: {
      status: SiteDownloadDemoStatus;
      telegramSourceUrl: string | null;
      resolvedTargetUrls: string | null;
      selectedFilesJson: string | null;
      errorMessage: string | null;
      ignoredAt: Date | null;
      completedAt: Date | null;
      updatedAt: Date;
    } | null;
  };
  inspectResult: TelegramInspectSourceResult | null;
  inspectError: string | null;
  detectedObjects: Array<{
    objectKey: string;
    fileName: string;
    byteSize: number;
    mimeType: string;
    lastModified: Date | null;
  }>;
  success?: string;
  error?: string;
};

function formatBytes(byteSize: number) {
  if (byteSize >= 1024 * 1024 * 1024) {
    return `${(byteSize / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  if (byteSize >= 1024 * 1024) {
    return `${(byteSize / 1024 / 1024).toFixed(1)} MB`;
  }

  if (byteSize >= 1024) {
    return `${(byteSize / 1024).toFixed(1)} KB`;
  }

  return `${byteSize} B`;
}

function getStatusCopy(status: SiteDownloadDemoStatus | null | undefined) {
  switch (status) {
    case SiteDownloadDemoStatus.IGNORED:
      return "Ignored";
    case SiteDownloadDemoStatus.UPLOADED:
      return "Uploaded";
    case SiteDownloadDemoStatus.FAILED:
      return "Failed";
    default:
      return "Pending";
  }
}

export function SiteDownloadDemoPanel({
  content,
  inspectResult,
  inspectError,
  detectedObjects,
  success,
  error
}: SiteDownloadDemoPanelProps) {
  const demoStatus = content.siteDownloadDemo?.status ?? null;
  const resolvedLinks = inspectResult?.resolvedLinks ?? [];
  const totalCandidates = resolvedLinks.reduce((total, link) => total + link.candidates.length, 0);
  const canUploadMore =
    Boolean(content.telegramSourceUrl) &&
    demoStatus !== SiteDownloadDemoStatus.IGNORED &&
    demoStatus !== SiteDownloadDemoStatus.UPLOADED;
  const canMarkComplete =
    demoStatus !== SiteDownloadDemoStatus.IGNORED &&
    demoStatus !== SiteDownloadDemoStatus.UPLOADED &&
    (content.hostedFiles.length > 0 || detectedObjects.length > 0);

  return (
    <div className="grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow">Admin Only</div>
            <h1 className="title-lg">Site Download Demo</h1>
            <p className="muted">
              Inspect Telegram media from the source link, choose the correct file, and upload directly to R2 without
              saving a local copy.
            </p>
          </div>
          <div className="inline-actions">
            <Link href="/admin/site-download-demo" className="button secondary">
              Back to Queue
            </Link>
            <Link href={`/admin/contents/${content.id}/edit`} className="link-pill">
              Open Content Editor
            </Link>
            <Link href={buildContentHref(content.slug)} className="link-pill">
              View Public Page
            </Link>
          </div>
        </div>

        {success ? <div className="notice success">{success}</div> : null}
        {error ? <div className="notice error">{error}</div> : null}

        <div className="admin-stats-grid">
          <article className="admin-stat-card">
            <span className="eyebrow">Content</span>
            <strong>{content.id}</strong>
            <small>{content.slug}</small>
          </article>
          <article className="admin-stat-card">
            <span className="eyebrow">Review</span>
            <strong>{content.reviewStatus}</strong>
            <small>{content.publishStatus}</small>
          </article>
          <article className="admin-stat-card">
            <span className="eyebrow">Demo Status</span>
            <strong>{getStatusCopy(demoStatus)}</strong>
            <small>Last update: {formatDateTime(content.siteDownloadDemo?.updatedAt ?? null)}</small>
          </article>
          <article className="admin-stat-card">
            <span className="eyebrow">Hosted Files</span>
            <strong>{content.hostedFiles.length}</strong>
            <small>{content.telegramSourceUrl ? "Telegram source detected" : "No Telegram source link"}</small>
          </article>
        </div>

        <div className="grid site-download-demo-meta-grid">
          <div className="admin-activity-card">
            <strong>{content.title}</strong>
            <div className="muted">Telegram source</div>
            {content.telegramSourceUrl ? (
              <a href={content.telegramSourceUrl} target="_blank" rel="noreferrer" className="link-pill">
                {content.telegramSourceUrl}
              </a>
            ) : (
              <div className="muted">This content does not have a Telegram source download link.</div>
            )}
          </div>
          <div className="admin-activity-card">
            <div className="muted">Demo record</div>
            <strong>{getStatusCopy(demoStatus)}</strong>
            {content.siteDownloadDemo?.errorMessage ? <small>{content.siteDownloadDemo.errorMessage}</small> : null}
            {content.siteDownloadDemo?.ignoredAt ? <small>Ignored: {formatDateTime(content.siteDownloadDemo.ignoredAt)}</small> : null}
            {content.siteDownloadDemo?.completedAt ? (
              <small>Completed: {formatDateTime(content.siteDownloadDemo.completedAt)}</small>
            ) : null}
          </div>
        </div>
      </section>

      {content.hostedFiles.length ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Already Hosted</div>
              <h2 className="title-lg">Existing Website Files</h2>
            </div>
            <span className="status">{content.hostedFiles.length} file(s)</span>
          </div>

          <div className="hosted-file-list">
            {content.hostedFiles.map((file) => (
              <div key={file.id} className="hosted-file-card">
                <strong>{file.fileName}</strong>
                <small>{file.mimeType}</small>
                <small>{formatBytes(file.byteSize)}</small>
                <small>{file.objectKey}</small>
                <small>Uploaded: {formatDateTime(file.createdAt)}</small>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {detectedObjects.length ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">R2 Sync Check</div>
              <h2 className="title-lg">Detected in R2 but Not Linked Yet</h2>
            </div>
            <span className="status">{detectedObjects.length} file(s)</span>
          </div>

          <div className="notice">
            These files already exist in the content&apos;s R2 folder, but the editor has not linked them into Hosted
            Files yet. Marking the demo complete will sync them first.
          </div>

          <div className="hosted-file-list">
            {detectedObjects.map((file) => (
              <div key={file.objectKey} className="hosted-file-card">
                <strong>{file.fileName}</strong>
                <small>{file.mimeType}</small>
                <small>{formatBytes(file.byteSize)}</small>
                <small>{file.objectKey}</small>
                <small>Last modified: {formatDateTime(file.lastModified)}</small>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {canUploadMore ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Telegram Candidates</div>
              <h2 className="title-lg">Resolve and Choose Media</h2>
            </div>
            <span className="status">{totalCandidates} candidate(s)</span>
          </div>

          {inspectError ? <div className="notice error">{inspectError}</div> : null}
          {!inspectError && !resolvedLinks.length ? (
            <div className="notice">No matching Telegram download link was found inside the source message.</div>
          ) : null}

          {resolvedLinks.length ? <SiteDownloadDemoUploader contentId={content.id} resolvedLinks={resolvedLinks} /> : null}
        </section>
      ) : null}

      {canMarkComplete ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Final Review</div>
              <h2 className="title-lg">Leave Pending Status</h2>
            </div>
          </div>

          <p className="muted">
            After you confirm the uploaded file is visible in the content editor and the public Website Download button
            is correct, mark this demo as complete. Any missing files found in the R2 folder will be synced first.
          </p>

          <form action={completeSiteDownloadDemoAction}>
            <input type="hidden" name="contentId" value={content.id} />
            <input type="hidden" name="redirectTo" value={`/admin/site-download-demo/${content.id}`} />
            <button type="submit">Mark Complete</button>
          </form>
        </section>
      ) : null}

      {content.telegramSourceUrl && !content.hostedFiles.length && detectedObjects.length === 0 ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Skip Option</div>
              <h2 className="title-lg">Ignore This Content</h2>
            </div>
          </div>

          <p className="muted">
            If this content has been reviewed and does not need a website download file, ignore it so it no longer
            appears in the demo queue.
          </p>

          <form action={ignoreSiteDownloadDemoAction}>
            <input type="hidden" name="contentId" value={content.id} />
            <input type="hidden" name="redirectTo" value={`/admin/site-download-demo/${content.id}`} />
            <button type="submit" className="button secondary">
              Ignore This Content
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
