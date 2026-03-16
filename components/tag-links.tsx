import Link from "next/link";

type TagLinksProps = {
  title: string;
  tags: Array<{
    name: string;
    slug: string;
  }>;
  type: "author" | "style" | "usage" | "type";
};

export function TagLinks({ title, tags, type }: TagLinksProps) {
  if (!tags.length) {
    return null;
  }

  return (
    <section className="tag-section">
      <strong>{title}</strong>
      <div className="tag-group">
        {tags.map((tag) => {
          const href =
            type === "author"
              ? `/search?author=${tag.slug}`
              : `/search?${type === "type" ? "types" : `${type}s`}=${tag.slug}`;
          return (
            <Link key={tag.slug} href={href} className="link-pill">
              {tag.name}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
