import { buildLocalizedContentHref, type UiLocale } from "@/lib/ui-locale";

export function buildContentHref(slug: string, locale: UiLocale = "en") {
  return buildLocalizedContentHref(locale, slug);
}
