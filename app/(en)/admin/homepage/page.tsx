import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { buildContentHref } from "@/lib/content-href";
import { HOMEPAGE_HOT_TOPIC_SLOT_COUNT, getHomepageHotTopicContents } from "@/lib/content";
import { getTaipeiDateKey } from "@/lib/hot-topic";

export default async function AdminHomepagePage() {
  await requireAdmin({ touchActivity: false });
  const dateKey = getTaipeiDateKey();
  const contents = await getHomepageHotTopicContents();

  return (
    <div className="page-section grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow">Admin Only</div>
            <h1 className="title-lg">Homepage Hot Topic</h1>
          </div>
          <div className="inline-actions">
            <Link href="/admin" className="button secondary">
              Back to Dashboard
            </Link>
            <Link href="/admin/homepage/bulletins" className="button secondary">
              Bulletin Manager
            </Link>
            <Link href="/" className="button secondary">
              View Homepage
            </Link>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow">Automatic Daily Rotation</div>
            <h2 className="title-lg">Today&apos;s Hot Topic Preview</h2>
            <p className="muted">
              Uses the Taipei calendar date. A different set of published posts is selected each day,
              with no overlap with the previous day while the candidate pool allows it.
            </p>
          </div>
          <span className="status-pill">
            {dateKey} · {contents.length}/{HOMEPAGE_HOT_TOPIC_SLOT_COUNT} posts
          </span>
        </div>

        <div className="admin-homepage-picker-grid">
          {contents.map((content, index) => (
            <article key={content.id} className="admin-homepage-picker-card">
              <Image
                src={content.coverImageUrl}
                alt={content.title}
                className="admin-homepage-picker-image"
                width={1200}
                height={900}
              />
              <div className="admin-homepage-picker-copy">
                <div className="eyebrow">Position {index + 1}</div>
                <strong>{content.title}</strong>
                <p className="muted">{content.slug}</p>
                <div className="inline-actions">
                  <Link href={buildContentHref(content.slug)} className="link-pill">
                    Open Content
                  </Link>
                  <Link href={`/admin/contents/${content.id}/edit`} className="button secondary">
                    Edit Content
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>

        {!contents.length ? (
          <div className="notice error">No published content is available for Hot Topic.</div>
        ) : null}
      </section>
    </div>
  );
}
