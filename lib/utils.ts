export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function formatTagTypeLabel(type: string) {
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "Never";
  }

  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
