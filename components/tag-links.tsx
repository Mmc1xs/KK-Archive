import Link from "next/link";
import { getLocaleSearchHref, type UiLocale } from "@/lib/ui-locale";

type TagLinksProps = {
  title: string;
  tags: Array<{
    name: string;
    slug: string;
  }>;
  type: "author" | "work" | "character" | "style" | "usage" | "type";
  locale?: UiLocale;
};

export function TagLinks({ title, tags, type, locale = "en" }: TagLinksProps) {
  if (!tags.length) {
    return null;
  }

  const searchHref = getLocaleSearchHref(locale);

  return (
    <section className="tag-section">
      <strong>{title}</strong>
      <div className="tag-group">
        {tags.map((tag) => {
          if (type === "character") {
            return (
              <span key={tag.slug} className="link-pill">
                {tag.name}
              </span>
            );
          }

          const href =
            type === "author"
              ? `${searchHref}?author=${tag.slug}`
              : type === "work"
                ? `${searchHref}?work=${tag.slug}`
                : `${searchHref}?${type === "type" ? "types" : `${type}s`}=${tag.slug}`;

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
