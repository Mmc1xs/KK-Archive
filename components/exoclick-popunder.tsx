"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const EXOCLICK_POPUNDER_ZONE_ID = process.env.NEXT_PUBLIC_EXOCLICK_POPUNDER_ZONE_ID?.trim();
const EXOCLICK_POPUNDER_TRIGGER_CLASS =
  process.env.NEXT_PUBLIC_EXOCLICK_POPUNDER_TRIGGER_CLASS?.trim() || "exo-download-trigger";
const EXOCLICK_POPUNDER_FREQUENCY_PERIOD =
  process.env.NEXT_PUBLIC_EXOCLICK_POPUNDER_FREQUENCY_PERIOD?.trim() || "720";
const EXOCLICK_POPUNDER_FREQUENCY_COUNT =
  process.env.NEXT_PUBLIC_EXOCLICK_POPUNDER_FREQUENCY_COUNT?.trim() || "1";
const EXOCLICK_POPUNDER_POPUP_FORCE =
  process.env.NEXT_PUBLIC_EXOCLICK_POPUNDER_POPUP_FORCE?.trim() || "true";
const EXOCLICK_POPUNDER_NEW_TAB = process.env.NEXT_PUBLIC_EXOCLICK_POPUNDER_NEW_TAB?.trim() || "true";
const EXOCLICK_POPUNDER_CAPPING_ENABLED =
  process.env.NEXT_PUBLIC_EXOCLICK_POPUNDER_CAPPING_ENABLED?.trim() || "false";
const EXOCLICK_POPUNDER_SCRIPT_ID = "exoclick-popunder-loader";
const EXOCLICK_POPUNDER_SCRIPT_SRC = "https://a.pemsrv.com/popunder1000.js";

export function ExoClickPopunder() {
  const pathname = usePathname();

  if (!EXOCLICK_POPUNDER_ZONE_ID) {
    return null;
  }

  useEffect(() => {
    const reloadScript = () => {
      const prev = document.getElementById(EXOCLICK_POPUNDER_SCRIPT_ID);
      if (prev) {
        prev.remove();
      }

      const next = document.createElement("script");
      next.id = EXOCLICK_POPUNDER_SCRIPT_ID;
      next.async = true;
      next.type = "application/javascript";
      next.src = `${EXOCLICK_POPUNDER_SCRIPT_SRC}?v=${Date.now()}`;
      next.setAttribute("data-exo-idzone", EXOCLICK_POPUNDER_ZONE_ID);
      next.setAttribute("data-exo-popup_fallback", "false");
      next.setAttribute("data-exo-popup_force", EXOCLICK_POPUNDER_POPUP_FORCE);
      next.setAttribute("data-exo-chrome_enabled", "true");
      next.setAttribute("data-exo-new_tab", EXOCLICK_POPUNDER_NEW_TAB);
      next.setAttribute("data-exo-frequency_period", EXOCLICK_POPUNDER_FREQUENCY_PERIOD);
      next.setAttribute("data-exo-frequency_count", EXOCLICK_POPUNDER_FREQUENCY_COUNT);
      next.setAttribute("data-exo-trigger_method", "2");
      next.setAttribute("data-exo-trigger_class", EXOCLICK_POPUNDER_TRIGGER_CLASS);
      next.setAttribute("data-exo-trigger_delay", "0");
      next.setAttribute("data-exo-capping_enabled", EXOCLICK_POPUNDER_CAPPING_ENABLED);
      next.setAttribute("data-exo-tcf_enabled", "true");
      next.setAttribute("data-exo-only_inline", "false");
      document.body.appendChild(next);
    };

    // Wait one tick so route content and trigger elements exist before ExoClick binds click handlers.
    const timer = window.setTimeout(reloadScript, 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
