export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function formatTagTypeLabel(type: string) {
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

export function formatDateTime(value: Date | string | null | undefined) {
  return formatDateTimeForLocale(value, "zh-TW");
}

export function formatDateTimeForLocale(
  value: Date | string | null | undefined,
  locale: "en-US" | "zh-CN" | "ja-JP" | "zh-TW" = "zh-TW"
) {
  if (!value) {
    return locale === "zh-CN" ? "从未" : locale === "ja-JP" ? "なし" : "Never";
  }

  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
