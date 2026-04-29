import Image from "next/image";
import Link from "next/link";
import { ReviewStatus } from "@prisma/client";
import { reportPassedContentIssueAction } from "@/app/actions";
import { TagLinks } from "@/components/tag-links";
import { type UiLocale } from "@/lib/ui-locale";

type ContentDetailContent = {
  id: number;
  title: string;
  description: string | null;
  slug: string;
  coverImageUrl: string;
  publishStatus: string;
  reviewStatus: ReviewStatus;
  sourceLink: string | null;
  images: Array<{
    id: number;
    imageUrl: string;
  }>;
  contentTags: Array<{
    tag: {
      id: number;
      name: string;
      slug: string;
      type: string;
    };
  }>;
  downloadLinks: Array<{
    url: string;
  }>;
  hostedFiles: Array<{
    id: number;
    fileName: string;
  }>;
};

type SessionUser = {
  role: "ADMIN" | "AUDIT" | "MEMBER";
};

type NormalizedDownloadEntry = {
  kind: "website" | "telegram" | "other";
  url: string;
  label: string;
};

type ContentDetailViewProps = {
  content: ContentDetailContent;
  user: SessionUser | null;
  tgDownloadLink?: string;
  siteDownloadEntries: NormalizedDownloadEntry[];
  locale: UiLocale;
  flashMessage?: {
    type: "success" | "error";
    message: string;
  };
  copy: {
    unverifiedTitle: string;
    unverifiedBody: string;
    visibleContentEyebrow: string;
    edit: string;
    originalSource: string;
    downloadLinks: string;
    telegramDownload: string;
    websiteDownload: string;
    websiteDownloads: (count: number) => string;
    type: string;
    author: string;
    work: string;
    character: string;
    style: string;
    usage: string;
    reviewStatus: {
      edited: string;
      passed: string;
      unverified: string;
    };
  };
};

function getReviewStatusMeta(reviewStatus: ReviewStatus, copy: ContentDetailViewProps["copy"]["reviewStatus"]) {
  switch (reviewStatus) {
    case ReviewStatus.EDITED:
      return { label: copy.edited, className: "status status-edited" };
    case ReviewStatus.PASSED:
      return { label: copy.passed, className: "status status-passed" };
    default:
      return { label: copy.unverified, className: "status status-unverified" };
  }
}

function getReportCopy(locale: UiLocale) {
  switch (locale) {
    case "zh-CN":
      return {
        label: "回报问题",
        hoverHint: "仅回报文件问题（例如图片损坏或下载链接失效）。"
      };
    case "ja":
      return {
        label: "問題を報告",
        hoverHint: "ファイルの問題（画像の破損やダウンロードリンク切れなど）のみ報告してください。"
      };
    default:
      return {
        label: "Report Issue",
        hoverHint: "Only report file issues (for example broken images or broken downloads)."
      };
  }
}
function buildContentDetailPath(locale: UiLocale, slug: string) {
  if (locale === "zh-CN") {
    return `/zh-CN/contents/${slug}`;
  }

  if (locale === "ja") {
    return `/ja/contents/${slug}`;
  }

  return `/contents/${slug}`;
}

export function ContentDetailView({
  content,
  user,
  tgDownloadLink,
  siteDownloadEntries,
  locale,
  flashMessage,
  copy
}: ContentDetailViewProps) {
  const authors = content.contentTags.filter((item) => item.tag.type === "AUTHOR").map((item) => item.tag);
  const works = content.contentTags.filter((item) => item.tag.type === "WORK").map((item) => item.tag);
  const characters = content.contentTags.filter((item) => item.tag.type === "CHARACTER").map((item) => item.tag);
  const styles = content.contentTags.filter((item) => item.tag.type === "STYLE").map((item) => item.tag);
  const usages = content.contentTags.filter((item) => item.tag.type === "USAGE").map((item) => item.tag);
  const types = content.contentTags.filter((item) => item.tag.type === "TYPE").map((item) => item.tag);
  const galleryImages = content.images.slice(1);
  const isStaff = user?.role === "ADMIN" || user?.role === "AUDIT";
  const canReportIssue =
    (user?.role === "MEMBER" || user?.role === "AUDIT" || user?.role === "ADMIN") &&
    content.reviewStatus === ReviewStatus.PASSED;
  const reviewStatusMeta = getReviewStatusMeta(content.reviewStatus, copy.reviewStatus);
  const description = content.description?.trim();
  const detailPath = buildContentDetailPath(locale, content.slug);
  const reportCopy = getReportCopy(locale);

  return (
    <div className="page-section grid">
      {flashMessage ? <div className={`notice ${flashMessage.type}`}>{flashMessage.message}</div> : null}
      {content.reviewStatus === ReviewStatus.UNVERIFIED ? (
        <section className="verification-warning" aria-label={copy.unverifiedTitle}>
          <strong>{copy.unverifiedTitle}</strong>
          <span>{copy.unverifiedBody}</span>
        </section>
      ) : null}
      <div className="detail-layout">
        <section className="panel">
          <div className="detail-image-media">
            <Image
              src={content.coverImageUrl}
              alt={content.title}
              className="detail-image"
              fill
              sizes="(max-width: 860px) 100vw, 50vw"
              priority
            />
          </div>
          {galleryImages.length ? (
            <div className="grid" style={{ marginTop: 20 }}>
              {galleryImages.map((image, index) => (
                <div key={image.id} className="detail-image-media">
                  <Image
                    src={image.imageUrl}
                    alt={content.title}
                    className="detail-image"
                    fill
                    sizes="(max-width: 860px) 100vw, 50vw"
                    priority={index < 2}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </section>
        <aside className="panel">
          <div className="eyebrow">{copy.visibleContentEyebrow}</div>
          {isStaff ? (
            <div className="admin-detail-actions">
              <Link href={`/admin/contents/${content.id}/edit`} className="link-pill admin-edit-link">
                {copy.edit}
              </Link>
            </div>
          ) : null}
          <h1 className="title-lg">{content.title}</h1>
          <div className="detail-status-row">
            <div className="status">{content.publishStatus}</div>
            {isStaff ? <div className={reviewStatusMeta.className}>{reviewStatusMeta.label}</div> : null}
            {canReportIssue ? (
              <form action={reportPassedContentIssueAction} className="report-issue-form">
                <input type="hidden" name="contentId" value={content.id} />
                <input type="hidden" name="issueType" value="fileIssue" />
                <input type="hidden" name="redirectTo" value={detailPath} />
                <button type="submit" className="link-pill" title={reportCopy.hoverHint}>
                  {reportCopy.label}
                </button>
              </form>
            ) : null}
          </div>
          {description ? <p className="muted">{description}</p> : null}
          {content.sourceLink ? (
            <section className="tag-section">
              <strong>{copy.originalSource}</strong>
              <div className="grid">
                <a href={content.sourceLink} target="_blank" rel="noreferrer" className="link-pill">
                  {content.sourceLink}
                </a>
              </div>
            </section>
          ) : null}
          {tgDownloadLink || siteDownloadEntries.length ? (
            <section className="tag-section">
              <strong>{copy.downloadLinks}</strong>
              <div className="tag-group download-link-group">
                {tgDownloadLink ? (
                  <a href={tgDownloadLink} target="_blank" rel="noreferrer" className="link-pill">
                    {copy.telegramDownload}
                  </a>
                ) : null}
                {siteDownloadEntries.length === 1 ? (
                  <a
                    href={siteDownloadEntries[0].url}
                    target="_blank"
                    rel="noreferrer"
                    className="link-pill exo-download-trigger"
                  >
                    {copy.websiteDownload}
                  </a>
                ) : null}
                {siteDownloadEntries.length > 1 ? (
                  <details className="download-menu">
                    <summary className="link-pill download-menu-trigger">
                      {copy.websiteDownloads(siteDownloadEntries.length)}
                    </summary>
                    <div className="download-menu-panel">
                      {siteDownloadEntries.map((entry) => (
                        <a
                          key={entry.url}
                          href={entry.url}
                          target="_blank"
                          rel="noreferrer"
                          className="download-menu-item exo-download-trigger"
                        >
                          {entry.label}
                        </a>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            </section>
          ) : null}
          <div className="grid">
            <TagLinks title={copy.type} tags={types} type="type" locale={locale} />
            <TagLinks title={copy.author} tags={authors} type="author" locale={locale} />
            <TagLinks title={copy.work} tags={works} type="work" locale={locale} />
            <TagLinks title={copy.character} tags={characters} type="character" locale={locale} />
            <TagLinks title={copy.style} tags={styles} type="style" locale={locale} />
            <TagLinks title={copy.usage} tags={usages} type="usage" locale={locale} />
          </div>
        </aside>
      </div>
    </div>
  );
}

