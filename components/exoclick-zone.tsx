"use client";

import { useEffect, useRef, useState } from "react";

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
  noFillTimeoutMs?: number;
};

export function ExoClickZone({
  zoneId,
  zoneClassName,
  className,
  noFillTimeoutMs = 4500
}: ExoClickZoneProps) {
  const loadedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const insRef = useRef<HTMLModElement | null>(null);
  const [status, setStatus] = useState<"loading" | "filled" | "empty">("loading");

  useEffect(() => {
    let cancelled = false;
    let noFillTimer: ReturnType<typeof setTimeout> | null = null;
    let observer: MutationObserver | null = null;

    const hasRenderableAd = () => {
      const container = containerRef.current;
      const ins = insRef.current;
      if (!container || !ins) {
        return false;
      }

      // ExoClick async banner usually injects iframe/content into the ins container.
      if (ins.childElementCount > 0) {
        return true;
      }

      if ((ins.textContent || "").trim().length > 0) {
        return true;
      }

      if (container.querySelector("iframe, video, object, embed, img")) {
        return true;
      }

      return false;
    };

    const markFilledIfReady = () => {
      if (cancelled) {
        return;
      }
      if (hasRenderableAd()) {
        setStatus((prev) => (prev === "filled" ? prev : "filled"));
        if (noFillTimer) {
          clearTimeout(noFillTimer);
          noFillTimer = null;
        }
      }
    };

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
        setStatus("loading");
        markFilledIfReady();

        observer = new MutationObserver(() => {
          markFilledIfReady();
        });
        observer.observe(containerRef.current, {
          childList: true,
          subtree: true,
          attributes: true
        });

        noFillTimer = setTimeout(() => {
          if (!cancelled && !hasRenderableAd()) {
            setStatus("empty");
          }
        }, noFillTimeoutMs);
      } catch {
        loadedRef.current = false;
        setStatus("empty");
      }
    }

    requestAd();

    return () => {
      cancelled = true;
      if (observer) {
        observer.disconnect();
      }
      if (noFillTimer) {
        clearTimeout(noFillTimer);
      }
    };
  }, [noFillTimeoutMs, zoneId]);

  if (status === "empty") {
    return null;
  }

  const combinedClassName = `${className ?? ""} ${status === "filled" ? "is-filled" : "is-loading"}`.trim();

  return (
    <div ref={containerRef} className={combinedClassName}>
      <ins ref={insRef} className={zoneClassName} data-zoneid={zoneId} />
    </div>
  );
}
