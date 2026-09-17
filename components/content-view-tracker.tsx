"use client";

import { useEffect } from "react";

type ContentViewTrackerProps = {
  contentId: number;
};

const VIEW_STORAGE_PREFIX = "kk_content_view_recorded";
const BOT_USER_AGENT_PATTERN = /(bot|crawler|spider|headless|preview|facebookexternalhit|slurp|bingpreview)/i;
const CONTENT_VIEW_TRACKING_ENABLED = process.env.NEXT_PUBLIC_KK_CONTENT_VIEW_TRACKING_ENABLED === "true";

function getTaipeiDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function shouldRecordView(contentId: number) {
  if (BOT_USER_AGENT_PATTERN.test(navigator.userAgent)) {
    return false;
  }

  try {
    const key = `${VIEW_STORAGE_PREFIX}:${contentId}:${getTaipeiDateKey()}`;
    if (window.localStorage.getItem(key)) {
      return false;
    }

    window.localStorage.setItem(key, "1");
  } catch {
    return true;
  }

  return true;
}

export function ContentViewTracker({ contentId }: ContentViewTrackerProps) {
  useEffect(() => {
    if (
      !CONTENT_VIEW_TRACKING_ENABLED ||
      !Number.isInteger(contentId) ||
      contentId <= 0 ||
      !shouldRecordView(contentId)
    ) {
      return;
    }

    const payload = JSON.stringify({ contentId });
    if (navigator.sendBeacon) {
      const body = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon("/api/content-views", body)) {
        return;
      }
    }

    void fetch("/api/content-views", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: payload,
      keepalive: true
    }).catch(() => {
      // View tracking should never disturb content browsing.
    });
  }, [contentId]);

  return null;
}
