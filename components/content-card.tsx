import Link from "next/link";

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
  const character = content.contentTags.find((item) => item.tag.type === "CHARACTER")?.tag.name ?? "Unknown character";

  return (
    <article className="card">
      <img className="card-image" src={content.coverImageUrl} alt={content.title} />
      <div className="card-body">
        <div className="eyebrow">{character}</div>
        <h3>
          <Link href={`/contents/${content.slug}`}>{content.title}</Link>
        </h3>
        {content.reviewStatus === "UNVERIFIED" ? <div className="card-warning-chip">Unverified</div> : null}
        <p className="muted">{author}</p>
      </div>
    </article>
  );
}
