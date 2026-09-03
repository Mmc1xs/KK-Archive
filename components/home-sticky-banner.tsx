"use client";

import { useEffect, useRef, useState } from "react";
import { ExoClickZone } from "@/components/exoclick-zone";

const EXOCLICK_HOME_STICKY_ZONE_ID = process.env.NEXT_PUBLIC_EXOCLICK_HOME_STICKY_ZONE_ID?.trim() || "5915396";
const EXOCLICK_HOME_STICKY_CLASS = process.env.NEXT_PUBLIC_EXOCLICK_HOME_STICKY_CLASS?.trim() || "eas6a97888e17";
const EXOCLICK_HOME_STICKY_ENABLED = (process.env.NEXT_PUBLIC_EXOCLICK_HOME_STICKY_ENABLED?.trim() || "true") !== "false";

export function HomeStickyBanner() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFilled, setIsFilled] = useState(false);

  useEffect(() => {
    const adInner = containerRef.current?.querySelector(".home-sticky-ad-inner");

    if (!adInner) {
      return;
    }

    const updateFilledState = () => {
      const hasRenderedAd = Boolean(
        adInner.querySelector('iframe, img[src], [id^="exo-sticky-container-"], [data-uid] iframe, [data-uid] img')
      );
      setIsFilled(hasRenderedAd);
    };

    updateFilledState();

    const observer = new MutationObserver(() => {
      updateFilledState();
    });

    observer.observe(adInner, { childList: true, subtree: true, characterData: true, attributes: true });

    return () => {
      observer.disconnect();
    };
  }, []);

  if (!EXOCLICK_HOME_STICKY_ENABLED || !EXOCLICK_HOME_STICKY_ZONE_ID || !EXOCLICK_HOME_STICKY_CLASS) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={[
        "home-sticky-ad",
        isFilled ? "is-filled" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <ExoClickZone
        className="home-sticky-ad-inner"
        zoneId={EXOCLICK_HOME_STICKY_ZONE_ID}
        zoneClassName={EXOCLICK_HOME_STICKY_CLASS}
      />
    </div>
  );
}
