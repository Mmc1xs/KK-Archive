"use client";

import { useEffect, useRef } from "react";
import styles from "./google-adsense-slot.module.css";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type GoogleAdSenseSlotProps = {
  slot?: string;
  className?: string;
  label?: string;
};

const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim();

export function GoogleAdSenseSlot({
  slot,
  className = "",
  label = "Sponsored"
}: GoogleAdSenseSlotProps) {
  const adSlot = slot?.trim();
  const adRef = useRef<HTMLModElement | null>(null);

  useEffect(() => {
    if (!ADSENSE_CLIENT_ID || !adSlot || !adRef.current) {
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 40;

    function loadAd() {
      if (cancelled || !adRef.current) {
        return;
      }

      if (adRef.current.getAttribute("data-adsbygoogle-status")) {
        return;
      }

      if (!Array.isArray(window.adsbygoogle)) {
        if (attempts >= maxAttempts) {
          return;
        }

        attempts += 1;
        window.setTimeout(loadAd, 250);
        return;
      }

      try {
        window.adsbygoogle.push({});
      } catch {
        if (attempts >= maxAttempts) {
          return;
        }

        attempts += 1;
        window.setTimeout(loadAd, 250);
      }
    }

    loadAd();

    return () => {
      cancelled = true;
    };
  }, [adSlot]);

  if (!ADSENSE_CLIENT_ID || !adSlot) {
    if (process.env.NODE_ENV !== "production") {
      return (
        <section className={`${styles.shell} ${styles.disabled} ${className}`.trim()} aria-label={label}>
          <div className={styles.labelRow}>
            <span className="eyebrow">Sponsored</span>
            <span className="hero-intel-mini">Setup Needed</span>
          </div>
          <div className={styles.placeholder}>
            Add <code>NEXT_PUBLIC_ADSENSE_CLIENT_ID</code> and <code>NEXT_PUBLIC_ADSENSE_HOME_SLOT_ID</code> to enable
            the homepage ad slot.
          </div>
        </section>
      );
    }

    return null;
  }

  return (
    <section className={`${styles.shell} ${className}`.trim()} aria-label={label}>
      <div className={styles.labelRow}>
        <span className="eyebrow">Sponsored</span>
      </div>
      <ins
        ref={adRef}
        className={`adsbygoogle ${styles.frame}`}
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={adSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </section>
  );
}
