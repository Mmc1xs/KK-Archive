import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewStatus } from "@prisma/client";
import { TagLinks } from "@/components/tag-links";
import { getCurrentSession } from "@/lib/auth/session";
import { getBrowsableContentBySlug, recordContentView } from "@/lib/content";

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

  await recordContentView(content.id);

  const authors = content.contentTags.filter((item) => item.tag.type === "AUTHOR").map((item) => item.tag);
  const styles = content.contentTags.filter((item) => item.tag.type === "STYLE").map((item) => item.tag);
  const usages = content.contentTags.filter((item) => item.tag.type === "USAGE").map((item) => item.tag);
  const types = content.contentTags.filter((item) => item.tag.type === "TYPE").map((item) => item.tag);
  const galleryImages = content.images.slice(1);
  const isStaff = user?.role === "ADMIN" || user?.role === "AUDIT";
  const reviewStatusMeta = getReviewStatusMeta(content.reviewStatus);

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
          {content.downloadLinks.length ? (
            <section className="tag-section">
              <strong>Download Links</strong>
              <div className="grid">
                {content.downloadLinks.map((link) => (
                  <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="link-pill">
                    {link.url}
                  </a>
                ))}
              </div>
            </section>
          ) : null}
          <div className="grid">
            <TagLinks title="Type" tags={types} type="type" />
            <TagLinks title="Author" tags={authors} type="author" />
            <TagLinks title="Style" tags={styles} type="style" />
            <TagLinks title="Usage" tags={usages} type="usage" />
          </div>
        </aside>
      </div>
    </div>
  );
}
