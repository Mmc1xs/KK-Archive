"use client";

import { useEffect, useState } from "react";

const ADBLOCK_NOTICE_ENABLED = (process.env.NEXT_PUBLIC_ADBLOCK_NOTICE_ENABLED?.trim() || "true") !== "false";
const ADBLOCK_TEST_SCRIPT_SRC =
  process.env.NEXT_PUBLIC_ADBLOCK_TEST_SCRIPT_SRC?.trim() || "https://a.magsrv.com/ad-provider.js";
const ADBLOCK_NOTICE_DISMISS_HOURS = Number.parseInt(
  process.env.NEXT_PUBLIC_ADBLOCK_NOTICE_DISMISS_HOURS?.trim() || "24",
  10
);

type AdBlockNoticeCopy = {
  title: string;
  body: string;
  action: string;
  close: string;
};

type AdBlockNoticeModalProps = {
  copy: AdBlockNoticeCopy;
};

function getDismissKey() {
  if (typeof window === "undefined") {
    return "kk-adblock-notice-dismissed-at";
  }

  return `kk-adblock-notice-dismissed-at:${window.location.hostname}`;
}

function hasRecentDismiss() {
  if (typeof window === "undefined") {
    return false;
  }

  const raw = window.localStorage.getItem(getDismissKey());
  if (!raw) {
    return false;
  }

  const dismissedAt = Number.parseInt(raw, 10);
  if (!Number.isFinite(dismissedAt)) {
    return false;
  }

  const dismissWindowMs = (Number.isFinite(ADBLOCK_NOTICE_DISMISS_HOURS) ? ADBLOCK_NOTICE_DISMISS_HOURS : 24) * 60 * 60 * 1000;
  return Date.now() - dismissedAt < dismissWindowMs;
}

function storeDismiss() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getDismissKey(), String(Date.now()));
}

function clearDismiss() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getDismissKey());
}

function detectByBaitElement() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const bait = document.createElement("div");
  bait.className = "adsbox ad-banner ad-container pub_300x250 pub_728x90";
  bait.setAttribute("aria-hidden", "true");
  bait.style.position = "absolute";
  bait.style.left = "-9999px";
  bait.style.top = "-9999px";
  bait.style.height = "1px";
  bait.style.width = "1px";
  bait.style.pointerEvents = "none";
  bait.textContent = "ad";

  document.body.appendChild(bait);
  const style = window.getComputedStyle(bait);
  const blocked =
    bait.offsetParent === null ||
    bait.offsetHeight === 0 ||
    bait.clientHeight === 0 ||
    style.display === "none" ||
    style.visibility === "hidden";
  bait.remove();

  return blocked;
}

function detectByScriptLoad() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      script.remove();
      resolve(false);
    }, 2500);

    script.async = true;
    script.type = "application/javascript";
    script.src = `${ADBLOCK_TEST_SCRIPT_SRC}${ADBLOCK_TEST_SCRIPT_SRC.includes("?") ? "&" : "?"}cb=${Date.now()}`;
    script.onload = () => {
      window.clearTimeout(timeout);
      script.remove();
      resolve(false);
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      script.remove();
      resolve(true);
    };

    document.body.appendChild(script);
  });
}

export function AdBlockNoticeModal({ copy }: AdBlockNoticeModalProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!ADBLOCK_NOTICE_ENABLED || hasRecentDismiss()) {
      return;
    }

    let cancelled = false;

    async function runDetection() {
      const blockedByBait = detectByBaitElement();
      const blockedByScript = await detectByScriptLoad();

      if (!cancelled && (blockedByBait || blockedByScript)) {
        setOpen(true);
      }
    }

    runDetection();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!open) {
    return null;
  }

  return (
    <div className="adblock-notice-overlay" role="dialog" aria-modal="true" aria-labelledby="adblock-notice-title">
      <div className="adblock-notice-modal">
        <h2 id="adblock-notice-title">{copy.title}</h2>
        <p>{copy.body}</p>
        <div className="adblock-notice-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              clearDismiss();
              window.location.reload();
            }}
          >
            {copy.action}
          </button>
          <button
            type="button"
            className="button"
            onClick={() => {
              storeDismiss();
              setOpen(false);
            }}
          >
            {copy.close}
          </button>
        </div>
      </div>
    </div>
  );
}
