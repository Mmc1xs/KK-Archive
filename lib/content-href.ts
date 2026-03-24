export function buildContentHref(slug: string) {
  return `/contents/${encodeURIComponent(slug)}`;
}
