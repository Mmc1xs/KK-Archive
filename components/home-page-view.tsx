import Image from "next/image";
import Link from "next/link";
import { ContentCard } from "@/components/content-card";
import { GoogleAdSenseSlot } from "@/components/google-adsense-slot";
import { getLocaleContentsHref, getLocaleSearchHref, type UiLocale } from "@/lib/ui-locale";

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

type HomePageCopy = {
  heroEyebrow: string;
  heroScreenReaderTitle: string;
  featurePills: [string, string, string];
  searchArchiveLabel: string;
  browseFilesLabel: string;
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
  overviewStats: HomePageOverviewStats;
  copy: HomePageCopy;
  locale?: UiLocale;
};

export function HomePageView({
  hotTopicContents,
  latestPublishedContents,
  overviewStats,
  copy,
  locale = "en"
}: HomePageViewProps) {
  const featuredContent = hotTopicContents[0] ?? latestPublishedContents[0];
  const searchHref = getLocaleSearchHref(locale);
  const contentsHref = getLocaleContentsHref(locale);

  return (
    <div className="page-section grid">
      <section className="hero">
        <div className="hero-layout">
          <div className="hero-copy">
            <div className="hero-copy-top">
              <div className="eyebrow">{copy.heroEyebrow}</div>
              <h1 className="sr-only">{copy.heroScreenReaderTitle}</h1>
            </div>
            <div className="hero-copy-reserved">
              <GoogleAdSenseSlot slot={process.env.NEXT_PUBLIC_ADSENSE_HOME_SLOT_ID} label="Homepage sponsor" />
            </div>
            <div className="hero-copy-bottom">
              <div className="hero-feature-pills">
                {copy.featurePills.map((item) => (
                  <span key={item} className="hero-feature-pill">
                    {item}
                  </span>
                ))}
              </div>
              <div className="inline-actions">
                <Link href={searchHref} className="button">
                  {copy.searchArchiveLabel}
                </Link>
                <Link href={contentsHref} className="link-pill">
                  {copy.browseFilesLabel}
                </Link>
              </div>
            </div>
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
    </div>
  );
}
