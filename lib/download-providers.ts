export function isTelegramUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "t.me" || parsed.hostname === "telegram.me" || parsed.hostname.endsWith(".t.me");
  } catch {
    return false;
  }
}

export function isApexDriveUrl(url: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return (
      hostname === "newapexcloud.com" ||
      hostname.endsWith(".newapexcloud.com") ||
      hostname.includes("apexdrive")
    );
  } catch {
    return false;
  }
}
