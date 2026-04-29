"use client";

import { useEffect, useRef } from "react";

type AdProviderCommand = {
  serve: Record<string, never>;
};

declare global {
  interface Window {
    AdProvider?: AdProviderCommand[];
  }
}

const EXOCLICK_SCRIPT_SRC = "https://a.magsrv.com/ad-provider.js";
let exoclickScriptPromise: Promise<void> | null = null;

function ensureExoClickScript() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (Array.isArray(window.AdProvider)) {
    return Promise.resolve();
  }

  if (!exoclickScriptPromise) {
    exoclickScriptPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${EXOCLICK_SCRIPT_SRC}"]`) as HTMLScriptElement | null;

      if (existingScript) {
        if (existingScript.dataset.loaded === "true") {
          resolve();
          return;
        }

        existingScript.addEventListener(
          "load",
          () => {
            existingScript.dataset.loaded = "true";
            resolve();
          },
          { once: true }
        );
        existingScript.addEventListener("error", () => reject(new Error("Failed to load ExoClick script")), {
          once: true
        });
        return;
      }

      const script = document.createElement("script");
      script.async = true;
      script.type = "application/javascript";
      script.src = EXOCLICK_SCRIPT_SRC;
      script.dataset.loaded = "false";
      script.onload = () => {
        script.dataset.loaded = "true";
        resolve();
      };
      script.onerror = () => reject(new Error("Failed to load ExoClick script"));
      document.body.appendChild(script);
    });
  }

  return exoclickScriptPromise.catch(() => {
    exoclickScriptPromise = null;
  });
}

type ExoClickZoneProps = {
  zoneId: string;
  zoneClassName: string;
  className?: string;
};

export function ExoClickZone({ zoneId, zoneClassName, className }: ExoClickZoneProps) {
  const loadedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function requestAd() {
      if (loadedRef.current || !containerRef.current) {
        return;
      }

      await ensureExoClickScript();

      if (cancelled || loadedRef.current) {
        return;
      }

      try {
        (window.AdProvider = window.AdProvider || []).push({ serve: {} });
        loadedRef.current = true;
      } catch {
        loadedRef.current = false;
      }
    }

    requestAd();

    return () => {
      cancelled = true;
    };
  }, [zoneId]);

  return (
    <div ref={containerRef} className={className}>
      <ins className={zoneClassName} data-zoneid={zoneId} />
    </div>
  );
}
