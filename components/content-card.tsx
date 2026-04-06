import { buildContentHref } from "@/lib/content-href";
import { ContentCardLink } from "@/components/content-card-link";
import { type UiLocale } from "@/lib/ui-locale";

type ContentCardProps = {
  content: {
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
  locale?: UiLocale;
};

const localeLabels: Record<UiLocale, { unknown: string; unverified: string }> = {
  en: {
    unknown: "Unknown",
    unverified: "Unverified"
  },
  "zh-CN": {
    unknown: "未知",
    unverified: "未校验"
  },
  ja: {
    unknown: "不明",
    unverified: "未確認"
  }
};

export function ContentCard({ content, locale = "en" }: ContentCardProps) {
  const labels = localeLabels[locale];
  const author = content.contentTags.find((item) => item.tag.type === "AUTHOR")?.tag.name ?? labels.unknown;
  const character = content.contentTags.find((item) => item.tag.type === "CHARACTER")?.tag.name;
  const normalizedCharacter = character?.trim().toLowerCase();
  const shouldFallbackToAuthor =
    !normalizedCharacter || normalizedCharacter === "unknown character" || normalizedCharacter === "unknown";
  const eyebrowLabel = shouldFallbackToAuthor ? author : (character as string);
  const contentHref = buildContentHref(content.slug, locale);

  return (
    <ContentCardLink href={contentHref} locale={locale}>
      <img className="card-image" src={content.coverImageUrl} alt={content.title} />
      <div className="card-body">
        <div className="eyebrow">{eyebrowLabel}</div>
        <h3>{content.title}</h3>
        {content.reviewStatus === "UNVERIFIED" ? <div className="card-warning-chip">{labels.unverified}</div> : null}
        <p className="muted">{author}</p>
      </div>
    </ContentCardLink>
  );
}
