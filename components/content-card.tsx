import Link from "next/link";
import { buildContentHref } from "@/lib/content-href";

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
};

export function ContentCard({ content }: ContentCardProps) {
  const author = content.contentTags.find((item) => item.tag.type === "AUTHOR")?.tag.name ?? "Unknown";
  const character = content.contentTags.find((item) => item.tag.type === "CHARACTER")?.tag.name;
  const normalizedCharacter = character?.trim().toLowerCase();
  const shouldFallbackToAuthor =
    !normalizedCharacter || normalizedCharacter === "unknown character" || normalizedCharacter === "unknown";
  const eyebrowLabel = shouldFallbackToAuthor ? author : (character as string);
  const contentHref = buildContentHref(content.slug);

  return (
    <Link href={contentHref} prefetch={false} className="card" style={{ display: "block", height: "100%" }}>
      <img className="card-image" src={content.coverImageUrl} alt={content.title} />
      <div className="card-body">
        <div className="eyebrow">{eyebrowLabel}</div>
        <h3>{content.title}</h3>
        {content.reviewStatus === "UNVERIFIED" ? <div className="card-warning-chip">Unverified</div> : null}
        <p className="muted">{author}</p>
      </div>
    </Link>
  );
}
