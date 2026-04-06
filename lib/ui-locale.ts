export type UiLocale = "en" | "zh-CN" | "ja";

export const UI_LOCALES: UiLocale[] = ["en", "zh-CN", "ja"];

export function getCurrentUiLocale(pathname: string): UiLocale {
  if (pathname === "/zh-CN" || pathname.startsWith("/zh-CN/")) {
    return "zh-CN";
  }

  if (pathname === "/ja" || pathname.startsWith("/ja/")) {
    return "ja";
  }

  return "en";
}

export function getLocalePrefix(locale: UiLocale) {
  return locale === "en" ? "" : `/${locale}`;
}

export function buildLocalizedHref(locale: UiLocale, path: string) {
  if (path === "/") {
    return getLocaleHomeHref(locale);
  }

  return `${getLocalePrefix(locale)}${path}`;
}

export function getLocaleHomeHref(locale: UiLocale) {
  return locale === "en" ? "/" : `/${locale}`;
}

export function getLocaleContentsHref(locale: UiLocale) {
  return buildLocalizedHref(locale, "/contents");
}

export function getLocaleSearchHref(locale: UiLocale) {
  return buildLocalizedHref(locale, "/search");
}

export function buildLocalizedContentHref(locale: UiLocale, slug: string) {
  return buildLocalizedHref(locale, `/contents/${encodeURIComponent(slug)}`);
}

export function getLocaleLoginHref(locale: UiLocale) {
  return buildLocalizedHref(locale, "/login");
}

export function getLocaleRegisterHref(locale: UiLocale) {
  return buildLocalizedHref(locale, "/register");
}

export function getLocaleProfileHref(locale: UiLocale) {
  return buildLocalizedHref(locale, "/profile");
}

export function getLocaleProfileUsernameHref(locale: UiLocale) {
  return buildLocalizedHref(locale, "/profile/username");
}

export function getLocaleSupportHref(locale: UiLocale) {
  return buildLocalizedHref(locale, "/support");
}

export function getLocalePrivacyHref(locale: UiLocale) {
  return buildLocalizedHref(locale, "/privacy");
}
