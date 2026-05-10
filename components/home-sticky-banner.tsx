"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExoClickZone } from "@/components/exoclick-zone";

const EXOCLICK_HOME_STICKY_ZONE_ID = process.env.NEXT_PUBLIC_EXOCLICK_HOME_STICKY_ZONE_ID?.trim() || "5915396";
const EXOCLICK_HOME_STICKY_CLASS = process.env.NEXT_PUBLIC_EXOCLICK_HOME_STICKY_CLASS?.trim() || "eas6a97888e17";
const EXOCLICK_HOME_STICKY_ENABLED = (process.env.NEXT_PUBLIC_EXOCLICK_HOME_STICKY_ENABLED?.trim() || "true") !== "false";
const EXOCLICK_HOME_STICKY_LOCAL_DEBUG = (process.env.NEXT_PUBLIC_EXOCLICK_HOME_STICKY_LOCAL_DEBUG?.trim() || "true") !== "false";
const EXOCLICK_HOME_STICKY_DISMISS_HOURS = Math.max(
  1,
  Number.parseInt(process.env.NEXT_PUBLIC_EXOCLICK_HOME_STICKY_DISMISS_HOURS?.trim() || "12", 10) || 12
);
const EXOCLICK_HOME_STICKY_DISMISS_KEY = "kk_exoclick_home_sticky_dismiss_until";

function isLocalhost() {
  if (typeof window === "undefined") {
    return false;
  }
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

export function HomeStickyBanner() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFilled, setIsFilled] = useState(false);
  const [isTimeout, setIsTimeout] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const shouldShowLocalDebug = useMemo(() => EXOCLICK_HOME_STICKY_LOCAL_DEBUG && isLocalhost(), []);

  useEffect(() => {
    try {
      const untilRaw = window.localStorage.getItem(EXOCLICK_HOME_STICKY_DISMISS_KEY);
      const until = untilRaw ? Number.parseInt(untilRaw, 10) : 0;
      if (Number.isFinite(until) && until > Date.now()) {
        setIsDismissed(true);
        return;
      }
      window.localStorage.removeItem(EXOCLICK_HOME_STICKY_DISMISS_KEY);
    } catch {
      // ignore storage errors
    }

    const timer = window.setTimeout(() => {
      setIsTimeout(true);
    }, 5000);

    const container = containerRef.current;
    const ins = container?.querySelector("ins");

    if (!ins) {
      return () => {
        window.clearTimeout(timer);
      };
    }

    const updateFilledState = () => {
      const hasRenderedChild = ins.childElementCount > 0;
      const hasRenderedMarkup = Boolean(ins.innerHTML.trim());
      if (hasRenderedChild || hasRenderedMarkup) {
        setIsFilled(true);
      }
    };

    updateFilledState();

    const observer = new MutationObserver(() => {
      updateFilledState();
    });

    observer.observe(ins, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      const until = Date.now() + EXOCLICK_HOME_STICKY_DISMISS_HOURS * 60 * 60 * 1000;
      window.localStorage.setItem(EXOCLICK_HOME_STICKY_DISMISS_KEY, String(until));
    } catch {
      // ignore storage errors
    }
  };

  if (!EXOCLICK_HOME_STICKY_ENABLED || !EXOCLICK_HOME_STICKY_ZONE_ID || !EXOCLICK_HOME_STICKY_CLASS || isDismissed) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={[
        "home-sticky-ad",
        isFilled ? "is-filled" : "",
        isTimeout ? "is-timeout" : "",
        shouldShowLocalDebug ? "is-local-debug" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button type="button" className="home-sticky-ad-close" onClick={handleDismiss} aria-label="Close sticky ad">
        x
      </button>
      <ExoClickZone
        className="home-sticky-ad-inner"
        zoneId={EXOCLICK_HOME_STICKY_ZONE_ID}
        zoneClassName={EXOCLICK_HOME_STICKY_CLASS}
      />
      {shouldShowLocalDebug ? (
        <div className="home-sticky-ad-debug" aria-live="polite">
          {isFilled ? "Sticky ad loaded" : isTimeout ? "Sticky ad mounted (no fill yet)" : "Sticky ad mounting..."}
        </div>
      ) : null}
    </div>
  );
}
