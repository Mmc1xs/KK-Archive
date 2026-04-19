import Image from "next/image";
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
    unverified: "未验证"
  },
  ja: {
    unknown: "不明",
    unverified: "未検証"
  }
};

export function ContentCard({ content, locale = "en" }: ContentCardProps) {
  const labels = localeLabels[locale];
  const author = content.contentTags.find((item) => item.tag.type === "AUTHOR")?.tag.name ?? labels.unknown;
  const work = content.contentTags.find((item) => item.tag.type === "WORK")?.tag.name ?? labels.unknown;
  const contentHref = buildContentHref(content.slug, locale);

  return (
    <ContentCardLink href={contentHref} locale={locale}>
      <Image
        className="card-image"
        src={content.coverImageUrl}
        alt={content.title}
        width={1200}
        height={900}
      />
      <div className="card-body">
        <div className="eyebrow">{work}</div>
        <h3>{content.title}</h3>
        {content.reviewStatus === "UNVERIFIED" ? <div className="card-warning-chip">{labels.unverified}</div> : null}
        <p className="muted">{author}</p>
      </div>
    </ContentCardLink>
  );
}
