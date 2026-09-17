import Image from "next/image";
import { ReviewStatus } from "@prisma/client";
import { AdBlockNoticeModal } from "@/components/adblock-notice-modal";
import { ContentDetailSessionActions } from "@/components/content-detail-session-actions";
import { ContentViewTracker } from "@/components/content-view-tracker";
import { HomeStickyBanner } from "@/components/home-sticky-banner";
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

type NormalizedDownloadEntry = {
  kind: "website" | "telegram" | "apexDrive" | "other";
  url: string;
  label: string;
};

type ContentDetailViewProps = {
  content: ContentDetailContent;
  tgDownloadLink?: string;
  siteDownloadEntries: NormalizedDownloadEntry[];
  apexDriveEntries: NormalizedDownloadEntry[];
  locale: UiLocale;
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
    apexDriveDownload: string;
    apexDriveDownloads: (count: number) => string;
    websiteDownloadLoginRequired: string;
    login: string;
    adBlockNotice: {
      title: string;
      body: string;
      action: string;
      close: string;
    };
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

export function ContentDetailView({
  content,
  tgDownloadLink,
  siteDownloadEntries,
  apexDriveEntries,
  locale,
  copy
}: ContentDetailViewProps) {
  const authors = content.contentTags.filter((item) => item.tag.type === "AUTHOR").map((item) => item.tag);
  const works = content.contentTags.filter((item) => item.tag.type === "WORK").map((item) => item.tag);
  const characters = content.contentTags.filter((item) => item.tag.type === "CHARACTER").map((item) => item.tag);
  const styles = content.contentTags.filter((item) => item.tag.type === "STYLE").map((item) => item.tag);
  const usages = content.contentTags.filter((item) => item.tag.type === "USAGE").map((item) => item.tag);
  const types = content.contentTags.filter((item) => item.tag.type === "TYPE").map((item) => item.tag);
  const galleryImages = content.images.slice(1);
  const reviewStatusMeta = getReviewStatusMeta(content.reviewStatus, copy.reviewStatus);
  const description = content.description?.trim();
  const canUseWebsiteDownload = siteDownloadEntries.length > 0;
  const canUseApexDriveDownload = apexDriveEntries.length > 0;

  return (
    <div className="page-section grid">
      <ContentViewTracker contentId={content.id} />
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
          <ContentDetailSessionActions
            contentId={content.id}
            reviewStatus={content.reviewStatus}
            locale={locale}
            placement="admin"
            editLabel={copy.edit}
          />
          <h1 className="title-lg">{content.title}</h1>
          <div className="detail-status-row">
            <div className="status">{content.publishStatus}</div>
            <ContentDetailSessionActions
              contentId={content.id}
              reviewStatus={content.reviewStatus}
              locale={locale}
              placement="status"
              reviewStatusLabel={reviewStatusMeta.label}
              reviewStatusClassName={reviewStatusMeta.className}
            />
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
          {tgDownloadLink || siteDownloadEntries.length || apexDriveEntries.length ? (
            <section className="tag-section">
              <strong>{copy.downloadLinks}</strong>
              <div className="tag-group download-link-group">
                {tgDownloadLink ? (
                  <a href={tgDownloadLink} target="_blank" rel="noreferrer" className="link-pill">
                    {copy.telegramDownload}
                  </a>
                ) : null}
                {canUseWebsiteDownload && siteDownloadEntries.length === 1 ? (
                  <a
                    href={siteDownloadEntries[0].url}
                    target="_blank"
                    rel="noreferrer"
                    className="link-pill exo-download-trigger"
                  >
                    {copy.websiteDownload}
                  </a>
                ) : null}
                {canUseWebsiteDownload && siteDownloadEntries.length > 1 ? (
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
                {canUseApexDriveDownload && apexDriveEntries.length === 1 ? (
                  <a
                    href={apexDriveEntries[0].url}
                    target="_blank"
                    rel="noreferrer"
                    className="link-pill exo-download-trigger"
                  >
                    {copy.apexDriveDownload}
                  </a>
                ) : null}
                {canUseApexDriveDownload && apexDriveEntries.length > 1 ? (
                  <details className="download-menu">
                    <summary className="link-pill download-menu-trigger">
                      {copy.apexDriveDownloads(apexDriveEntries.length)}
                    </summary>
                    <div className="download-menu-panel">
                      {apexDriveEntries.map((entry, index) => (
                        <a
                          key={entry.url}
                          href={entry.url}
                          target="_blank"
                          rel="noreferrer"
                          className="download-menu-item exo-download-trigger"
                        >
                          {`${copy.apexDriveDownload} ${index + 1}`}
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
      {siteDownloadEntries.length > 0 || apexDriveEntries.length > 0 ? <AdBlockNoticeModal copy={copy.adBlockNotice} /> : null}
      <HomeStickyBanner />
    </div>
  );
}

