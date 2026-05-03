import Image from "next/image";
import Link from "next/link";
import { ContentCard } from "@/components/content-card";
import { HomeStickyBanner } from "@/components/home-sticky-banner";
import { getLocaleContentsHref, type UiLocale } from "@/lib/ui-locale";

type HomePageContent = {
  title: string;
  slug: string;
  description: string;
  coverImageUrl: string;
  reviewStatus: "UNVERIFIED" | "EDITED" | "PASSED";
  contentTags: Array<{
    tag: {
      name: string;
      type: string;
      slug: string;
    };
  }>;
};

type HomePageOverviewStats = {
  totalPosts: number;
  indexedAuthors: number;
};

type HomePageBulletinItem = {
  id: number;
  title: string;
  summary: string;
  linkUrl: string | null;
  publishedAt: Date | string | null;
};

type HomePageCopy = {
  heroEyebrow: string;
  heroScreenReaderTitle: string;
  bulletinTitle?: string;
  bulletinEmptyTitle?: string;
  bulletinEmptyMeta?: string;
  briefingEyebrow: string;
  archiveOverviewLabel: string;
  onlineLabel: string;
  totalPostsEyebrow: string;
  totalPostsDescription: string;
  indexedAuthorsEyebrow: string;
  indexedAuthorsDescription: string;
  spotlightEyebrow: string;
  spotlightFallbackTitle: string;
  spotlightFallbackAuthor: string;
  roadmapEyebrow: string;
  roadmapItems: Array<{
    title: string;
    description: string;
  }>;
  reservedEyebrow: string;
  reservedLabel: string;
  hotTopicEyebrow: string;
  hotTopicTitle: string;
  latestPublishedEyebrow: string;
  latestPublishedTitle: string;
  viewMoreLabel: string;
};

type HomePageViewProps = {
  hotTopicContents: HomePageContent[];
  latestPublishedContents: HomePageContent[];
  bulletins: HomePageBulletinItem[];
  overviewStats: HomePageOverviewStats;
  copy: HomePageCopy;
  locale?: UiLocale;
};

function formatBulletinDate(value: Date | string | null, locale: UiLocale) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function HomePageView({
  hotTopicContents,
  latestPublishedContents,
  bulletins,
  overviewStats,
  copy,
  locale = "en"
}: HomePageViewProps) {
  const featuredContent = hotTopicContents[0] ?? latestPublishedContents[0];
  const contentsHref = getLocaleContentsHref(locale);
  const bulletinTitle = copy.bulletinTitle ?? copy.heroEyebrow;
  const bulletinEmptyTitle = copy.bulletinEmptyTitle ?? "No announcements yet";
  const bulletinEmptyMeta = copy.bulletinEmptyMeta ?? "Please check back later.";

  return (
    <div className="page-section grid">
      <section className="hero">
        <div className="hero-layout">
          <div className="hero-copy hero-copy-bulletin-demo">
            <h1 className="sr-only">{copy.heroScreenReaderTitle}</h1>
            <article className="hero-bulletin-board">
              <header className="hero-bulletin-head">
                <div className="eyebrow">{copy.heroEyebrow}</div>
                <h2>{bulletinTitle}</h2>
              </header>
              <div className="hero-bulletin-screen" aria-hidden="true" />
              <ul className="hero-bulletin-list">
                {(bulletins.length ? bulletins : [{ id: -1, title: bulletinEmptyTitle, summary: bulletinEmptyMeta, linkUrl: null, publishedAt: null }]).map(
                  (item) => (
                    <li key={`home-bulletin-${item.id}`} className="hero-bulletin-item">
                      <span className="hero-bulletin-item-icon" aria-hidden="true" />
                      <div className="hero-bulletin-item-copy">
                        {item.linkUrl ? (
                          <a href={item.linkUrl} target="_blank" rel="noreferrer">
                            <strong>{item.title}</strong>
                          </a>
                        ) : (
                          <strong>{item.title}</strong>
                        )}
                        <small>{item.summary}</small>
                      </div>
                      <time className="hero-bulletin-item-date">{formatBulletinDate(item.publishedAt, locale)}</time>
                    </li>
                  )
                )}
              </ul>
            </article>
          </div>

          <div className="hero-intel-panel">
            <div className="hero-intel-header">
              <div>
                <div className="eyebrow">{copy.briefingEyebrow}</div>
                <strong>{copy.archiveOverviewLabel}</strong>
              </div>
              <span className="hero-intel-status">{copy.onlineLabel}</span>
            </div>

            <div className="hero-intel-grid">
              <article className="hero-intel-card">
                <span className="eyebrow">{copy.totalPostsEyebrow}</span>
                <strong>{overviewStats.totalPosts}</strong>
                <small>{copy.totalPostsDescription}</small>
              </article>
              <article className="hero-intel-card">
                <span className="eyebrow">{copy.indexedAuthorsEyebrow}</span>
                <strong>{overviewStats.indexedAuthors}</strong>
                <small>{copy.indexedAuthorsDescription}</small>
              </article>
            </div>

            <article className="hero-spotlight-card">
              <div className="hero-spotlight-copy">
                <div className="eyebrow">{copy.spotlightEyebrow}</div>
                <strong>{featuredContent?.title ?? copy.spotlightFallbackTitle}</strong>
                <p className="muted">
                  {featuredContent?.contentTags.find((item) => item.tag.type === "AUTHOR")?.tag.name ?? copy.spotlightFallbackAuthor}
                </p>
              </div>
              {featuredContent ? (
                <Image
                  src={featuredContent.coverImageUrl}
                  alt={featuredContent.title}
                  className="hero-spotlight-image"
                  width={528}
                  height={528}
                />
              ) : null}
            </article>

            <article className="hero-intel-card hero-intel-list">
              <div className="hero-intel-list-header">
                <div className="eyebrow">{copy.roadmapEyebrow}</div>
              </div>
              <div className="hero-intel-list-items">
                {copy.roadmapItems.map((item) => (
                  <article key={item.title} className="hero-intel-list-item">
                    <span className="hero-intel-dot" aria-hidden="true" />
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.description}</small>
                    </div>
                  </article>
                ))}
              </div>
            </article>

            <article className="hero-intel-card">
              <div className="eyebrow">{copy.reservedEyebrow}</div>
              <span className="hero-intel-mini">{copy.reservedLabel}</span>
              <div className="hero-placeholder hero-placeholder-compact" aria-hidden="true" />
            </article>
          </div>
        </div>
      </section>

      {hotTopicContents.length ? (
        <section className="panel">
          <div className="split">
            <div>
              <div className="eyebrow">{copy.hotTopicEyebrow}</div>
              <h2 className="title-lg">{copy.hotTopicTitle}</h2>
            </div>
          </div>
          <div className="grid content-grid">
            {hotTopicContents.map((content) => (
              <article key={`hot-topic-${content.slug}`} className="hot-topic-demo-card">
                <ContentCard content={content} locale={locale} />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="split">
          <div>
            <div className="eyebrow">{copy.latestPublishedEyebrow}</div>
            <h2 className="title-lg">{copy.latestPublishedTitle}</h2>
          </div>
          <Link href={contentsHref} className="link-pill">
            {copy.viewMoreLabel}
          </Link>
        </div>
        <div className="grid content-grid">
          {latestPublishedContents.map((content) => (
            <ContentCard key={content.slug} content={content} locale={locale} />
          ))}
        </div>
      </section>
      <HomeStickyBanner />
    </div>
  );
}
