import Link from "next/link";
import { ContentCard } from "@/components/content-card";
import { getHomepageContents, getHomepageOverviewStats } from "@/lib/content";

export const revalidate = 300;
export const preferredRegion = "hkg1";

export default async function HomePage() {
  const [contents, overviewStats] = await Promise.all([getHomepageContents(), getHomepageOverviewStats()]);
  const featuredContent = contents[0];

  return (
    <div className="page-section grid">
      <section className="hero">
        <div className="hero-layout">
          <div className="hero-copy">
            <div className="hero-copy-top">
              <div className="eyebrow">KK File Index</div>
              <h1 className="sr-only">Find KK-related files through clean tag browsing.</h1>
            </div>
            <div className="hero-copy-reserved" aria-hidden="true" />
            <div className="hero-copy-bottom">
              <div className="hero-feature-pills">
                <span className="hero-feature-pill">Character cards</span>
                <span className="hero-feature-pill">Scene presets</span>
                <span className="hero-feature-pill">Textures & overlays</span>
              </div>
              <div className="inline-actions">
                <Link href="/search" className="button">
                  Search Archive
                </Link>
                <Link href="/contents" className="link-pill">
                  Browse Files
                </Link>
              </div>
            </div>
          </div>

          <div className="hero-intel-panel">
            <div className="hero-intel-header">
              <div>
                <div className="eyebrow">Academy Briefing</div>
                <strong>Archive Overview</strong>
              </div>
              <span className="hero-intel-status">Online</span>
            </div>

            <div className="hero-intel-grid">
              <article className="hero-intel-card">
                <span className="eyebrow">Total Posts</span>
                <strong>{overviewStats.totalPosts}</strong>
                <small>Published entries currently available in the archive</small>
              </article>
              <article className="hero-intel-card">
                <span className="eyebrow">Indexed Authors</span>
                <strong>{overviewStats.indexedAuthors}</strong>
                <small>Author tags currently available for structured browsing</small>
              </article>
            </div>

            <article className="hero-spotlight-card">
              <div className="hero-spotlight-copy">
                <div className="eyebrow">Spotlight Entry</div>
                <strong>{featuredContent?.title ?? "Latest archive entry"}</strong>
                <p className="muted">
                  {featuredContent?.contentTags.find((item) => item.tag.type === "AUTHOR")?.tag.name ?? "KK Archive"}
                </p>
              </div>
              {featuredContent ? (
                <img src={featuredContent.coverImageUrl} alt={featuredContent.title} className="hero-spotlight-image" />
              ) : null}
            </article>

            <article className="hero-intel-card hero-intel-list">
              <div className="hero-intel-list-header">
                <div className="eyebrow">Future Roadmap</div>
              </div>
              <div className="hero-intel-list-items">
                <article className="hero-intel-list-item">
                  <span className="hero-intel-dot" aria-hidden="true" />
                  <div>
                    <strong>Mod Library</strong>
                    <small>Add a dedicated mod library to support and extend the core card library workflow.</small>
                  </div>
                </article>
                <article className="hero-intel-list-item">
                  <span className="hero-intel-dot" aria-hidden="true" />
                  <div>
                    <strong>Post Likes</strong>
                    <small>Add post likes so members can quickly signal useful content.</small>
                  </div>
                </article>
              </div>
            </article>

            <article className="hero-intel-card">
              <div className="eyebrow">Reserved Panel</div>
              <span className="hero-intel-mini">Future Slot</span>
              <div className="hero-placeholder hero-placeholder-compact" aria-hidden="true" />
            </article>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="split">
          <div>
            <div className="eyebrow">Latest Published</div>
            <h2 className="title-lg">Latest Published Content</h2>
          </div>
          <Link href="/contents" className="link-pill">
            View More
          </Link>
        </div>
        <div className="grid content-grid">
          {contents.map((content) => (
            <ContentCard key={content.slug} content={content} />
          ))}
        </div>
      </section>
    </div>
  );
}
