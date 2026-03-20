import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewStatus } from "@prisma/client";
import { TagLinks } from "@/components/tag-links";
import { getCurrentSession } from "@/lib/auth/session";
import { getBrowsableContentBySlug, recordContentView } from "@/lib/content";
import { buildContentFileDownloadPath, buildLegacyContentFileDownloadPath } from "@/lib/downloads/content-file-token";
import { buildR2PublicUrl } from "@/lib/storage/r2";

export const preferredRegion = "hkg1";

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

function isTelegramUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "t.me" || parsed.hostname === "telegram.me" || parsed.hostname.endsWith(".t.me");
  } catch {
    return false;
  }
}

export default async function ContentDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentSession();
  const content = await getBrowsableContentBySlug(slug, Boolean(user));

  if (!content) {
    notFound();
  }

  void recordContentView(content.id).catch(() => {
    // Non-blocking analytics: view tracking failures should not block page rendering.
  });

  const authors = content.contentTags.filter((item) => item.tag.type === "AUTHOR").map((item) => item.tag);
  const works = content.contentTags.filter((item) => item.tag.type === "WORK").map((item) => item.tag);
  const characters = content.contentTags.filter((item) => item.tag.type === "CHARACTER").map((item) => item.tag);
  const styles = content.contentTags.filter((item) => item.tag.type === "STYLE").map((item) => item.tag);
  const usages = content.contentTags.filter((item) => item.tag.type === "USAGE").map((item) => item.tag);
  const types = content.contentTags.filter((item) => item.tag.type === "TYPE").map((item) => item.tag);
  const galleryImages = content.images.slice(1);
  const isStaff = user?.role === "ADMIN" || user?.role === "AUDIT";
  const reviewStatusMeta = getReviewStatusMeta(content.reviewStatus);
  const hostedInternalLinkByPublicUrl = new Map(
    content.hostedFiles.map((file) => [buildR2PublicUrl(file.objectKey), buildContentFileDownloadPath(file.id)])
  );
  const hostedInternalLinkByLegacyPath = new Map(
    content.hostedFiles.map((file) => [buildLegacyContentFileDownloadPath(file.id), buildContentFileDownloadPath(file.id)])
  );
  const hostedInternalLinkSet = new Set(content.hostedFiles.map((file) => buildContentFileDownloadPath(file.id)));
  const normalizedDownloadLinks = content.downloadLinks.map(
    (link) => hostedInternalLinkByPublicUrl.get(link.url) ?? hostedInternalLinkByLegacyPath.get(link.url) ?? link.url
  );
  const tgDownloadLink = normalizedDownloadLinks.find((url) => isTelegramUrl(url));
  const siteDownloadLink = normalizedDownloadLinks.find((url) => hostedInternalLinkSet.has(url));

  return (
    <div className="page-section grid">
      {content.reviewStatus === ReviewStatus.UNVERIFIED ? (
        <section className="verification-warning" aria-label="Unverified content warning">
          <strong>Unverified Content</strong>
          <span>This post has not been fully reviewed yet. Tags and metadata may still be incomplete or inaccurate.</span>
        </section>
      ) : null}
      <div className="detail-layout">
        <section className="panel">
          <img src={content.coverImageUrl} alt={content.title} className="card-image" loading="eager" decoding="sync" />
          {galleryImages.length ? (
            <div className="grid" style={{ marginTop: 20 }}>
              {galleryImages.map((image, index) => (
                <img
                  key={image.id}
                  src={image.imageUrl}
                  alt={content.title}
                  className="card-image"
                  loading={index < 2 ? "eager" : "lazy"}
                  decoding={index < 2 ? "sync" : "async"}
                />
              ))}
            </div>
          ) : null}
        </section>
        <aside className="panel">
          <div className="eyebrow">Visible Content</div>
          {isStaff ? (
            <div className="admin-detail-actions">
              <Link href={`/admin/contents/${content.id}/edit`} className="link-pill admin-edit-link">
                Edit
              </Link>
            </div>
          ) : null}
          <h1 className="title-lg">{content.title}</h1>
          <div className="detail-status-row">
            <div className="status">{content.publishStatus}</div>
            {isStaff ? <div className={reviewStatusMeta.className}>{reviewStatusMeta.label}</div> : null}
          </div>
          <p className="muted">{content.description}</p>
          {content.sourceLink ? (
            <section className="tag-section">
              <strong>Original Source</strong>
              <div className="grid">
                <a href={content.sourceLink} target="_blank" rel="noreferrer" className="link-pill">
                  {content.sourceLink}
                </a>
              </div>
            </section>
          ) : null}
          {tgDownloadLink || siteDownloadLink ? (
            <section className="tag-section">
              <strong>Download Links</strong>
              <div className="tag-group">
                {tgDownloadLink ? (
                  <a href={tgDownloadLink} target="_blank" rel="noreferrer" className="link-pill">
                    Telegram Download
                  </a>
                ) : null}
                {siteDownloadLink ? (
                  <a href={siteDownloadLink} target="_blank" rel="noreferrer" className="link-pill">
                    Website Download
                  </a>
                ) : null}
              </div>
            </section>
          ) : null}
          <div className="grid">
            <TagLinks title="Type" tags={types} type="type" />
            <TagLinks title="Author" tags={authors} type="author" />
            <TagLinks title="Work" tags={works} type="work" />
            <TagLinks title="Character" tags={characters} type="character" />
            <TagLinks title="Style" tags={styles} type="style" />
            <TagLinks title="Usage" tags={usages} type="usage" />
          </div>
        </aside>
      </div>
    </div>
  );
}
