"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const EXOCLICK_POPUNDER_ENABLED = (process.env.NEXT_PUBLIC_EXOCLICK_POPUNDER_ENABLED?.trim() || "true") !== "false";
const EXOCLICK_POPUNDER_ZONE_ID = process.env.NEXT_PUBLIC_EXOCLICK_POPUNDER_ZONE_ID?.trim() || "5913562";
const EXOCLICK_POPUNDER_TRIGGER_CLASS =
  process.env.NEXT_PUBLIC_EXOCLICK_POPUNDER_TRIGGER_CLASS?.trim() || "exo-download-trigger";
const EXOCLICK_SEARCH_FILTER_POPUNDER_ZONE_ID =
  process.env.NEXT_PUBLIC_EXOCLICK_SEARCH_FILTER_POPUNDER_ZONE_ID?.trim() || EXOCLICK_POPUNDER_ZONE_ID;
const EXOCLICK_SEARCH_FILTER_TRIGGER_CLASS =
  process.env.NEXT_PUBLIC_EXOCLICK_SEARCH_FILTER_TRIGGER_CLASS?.trim() || "exo-search-filter-trigger";
const EXOCLICK_MOD_LIBRARY_SEARCH_POPUNDER_ZONE_ID =
  process.env.NEXT_PUBLIC_EXOCLICK_MOD_LIBRARY_SEARCH_POPUNDER_ZONE_ID?.trim() || EXOCLICK_POPUNDER_ZONE_ID;
const EXOCLICK_MOD_LIBRARY_SEARCH_TRIGGER_CLASS =
  process.env.NEXT_PUBLIC_EXOCLICK_MOD_LIBRARY_SEARCH_TRIGGER_CLASS?.trim() || "exo-mod-library-search-trigger";
const EXOCLICK_MOD_LIBRARY_SEARCH_POPUNDER_FREQUENCY_PERIOD =
  process.env.NEXT_PUBLIC_EXOCLICK_MOD_LIBRARY_SEARCH_POPUNDER_FREQUENCY_PERIOD?.trim() || "1";
const EXOCLICK_MOD_LIBRARY_SEARCH_POPUNDER_FREQUENCY_COUNT =
  process.env.NEXT_PUBLIC_EXOCLICK_MOD_LIBRARY_SEARCH_POPUNDER_FREQUENCY_COUNT?.trim() || "9999";
const EXOCLICK_POPUNDER_FREQUENCY_PERIOD =
  process.env.NEXT_PUBLIC_EXOCLICK_POPUNDER_FREQUENCY_PERIOD?.trim() || "720";
const EXOCLICK_POPUNDER_FREQUENCY_COUNT =
  process.env.NEXT_PUBLIC_EXOCLICK_POPUNDER_FREQUENCY_COUNT?.trim() || "1";
const EXOCLICK_POPUNDER_POPUP_FORCE =
  process.env.NEXT_PUBLIC_EXOCLICK_POPUNDER_POPUP_FORCE?.trim() || "true";
const EXOCLICK_POPUNDER_NEW_TAB = process.env.NEXT_PUBLIC_EXOCLICK_POPUNDER_NEW_TAB?.trim() || "true";
const EXOCLICK_POPUNDER_CAPPING_ENABLED =
  process.env.NEXT_PUBLIC_EXOCLICK_POPUNDER_CAPPING_ENABLED?.trim() || "false";
const EXOCLICK_POPUNDER_CHROME_ENABLED =
  process.env.NEXT_PUBLIC_EXOCLICK_POPUNDER_CHROME_ENABLED?.trim() || "true";
const EXOCLICK_POPUNDER_TCF_ENABLED = process.env.NEXT_PUBLIC_EXOCLICK_POPUNDER_TCF_ENABLED?.trim() || "false";
const EXOCLICK_POPUNDER_CONFIG_SCRIPT_ID = "exoclick-popunder-config";
const EXOCLICK_POPUNDER_LOADER_SCRIPT_ID = "exoclick-popunder-loader";
const EXOCLICK_POPUNDER_SCRIPT_SRC = "https://a.pemsrv.com/popunder1000.js";

function toBoolString(value: string) {
  return value.toLowerCase() === "true" ? "true" : "false";
}

export function ExoClickPopunder() {
  const pathname = usePathname();

  useEffect(() => {
    const clearScripts = () => {
      document.getElementById(EXOCLICK_POPUNDER_CONFIG_SCRIPT_ID)?.remove();
      document.getElementById(EXOCLICK_POPUNDER_LOADER_SCRIPT_ID)?.remove();
    };

    if (!EXOCLICK_POPUNDER_ENABLED) {
      clearScripts();
      return;
    }

    const isContentDetailRoute =
      pathname.includes("/contents/") || pathname.includes("/zh-CN/contents/") || pathname.includes("/ja/contents/");
    const isSearchRoute = pathname === "/search" || pathname === "/zh-CN/search" || pathname === "/ja/search";
    const isModLibraryRoute =
      pathname === "/mod_library" || pathname === "/zh-CN/mod_library" || pathname === "/ja/mod_library";
    const activeZoneId = isSearchRoute
      ? EXOCLICK_SEARCH_FILTER_POPUNDER_ZONE_ID
      : isModLibraryRoute
        ? EXOCLICK_MOD_LIBRARY_SEARCH_POPUNDER_ZONE_ID
        : EXOCLICK_POPUNDER_ZONE_ID;
    const activeTriggerClass = isSearchRoute
      ? EXOCLICK_SEARCH_FILTER_TRIGGER_CLASS
      : isModLibraryRoute
        ? EXOCLICK_MOD_LIBRARY_SEARCH_TRIGGER_CLASS
        : EXOCLICK_POPUNDER_TRIGGER_CLASS;
    const activeFrequencyPeriod = isModLibraryRoute
      ? EXOCLICK_MOD_LIBRARY_SEARCH_POPUNDER_FREQUENCY_PERIOD
      : EXOCLICK_POPUNDER_FREQUENCY_PERIOD;
    const activeFrequencyCount = isModLibraryRoute
      ? EXOCLICK_MOD_LIBRARY_SEARCH_POPUNDER_FREQUENCY_COUNT
      : EXOCLICK_POPUNDER_FREQUENCY_COUNT;

    clearScripts();
    if ((!isContentDetailRoute && !isSearchRoute && !isModLibraryRoute) || !activeZoneId || !activeTriggerClass) {
      return;
    }

    const injectScript = () => {
      clearScripts();

      // ExoClick remote popunder snippet expects global ad_* variables before loading popunder1000.js.
      const configScript = document.createElement("script");
      configScript.id = EXOCLICK_POPUNDER_CONFIG_SCRIPT_ID;
      configScript.type = "application/javascript";
      configScript.text = [
        `var ad_idzone = ${JSON.stringify(activeZoneId)};`,
        "var ad_popup_fallback = false;",
        `var ad_popup_force = ${toBoolString(EXOCLICK_POPUNDER_POPUP_FORCE)};`,
        `var ad_chrome_enabled = ${toBoolString(EXOCLICK_POPUNDER_CHROME_ENABLED)};`,
        `var ad_new_tab = ${toBoolString(EXOCLICK_POPUNDER_NEW_TAB)};`,
        `var ad_frequency_period = ${Number.parseInt(activeFrequencyPeriod, 10) || 720};`,
        `var ad_frequency_count = ${Number.parseInt(activeFrequencyCount, 10) || 1};`,
        "var ad_trigger_method = 2;",
        `var ad_trigger_class = ${JSON.stringify(activeTriggerClass)};`,
        "var ad_trigger_delay = 0;",
        `var ad_capping_enabled = ${toBoolString(EXOCLICK_POPUNDER_CAPPING_ENABLED)};`,
        `var ad_tcf_enabled = ${toBoolString(EXOCLICK_POPUNDER_TCF_ENABLED)};`
      ].join("\n");
      document.body.appendChild(configScript);

      const loaderScript = document.createElement("script");
      loaderScript.id = EXOCLICK_POPUNDER_LOADER_SCRIPT_ID;
      loaderScript.async = true;
      loaderScript.type = "application/javascript";
      loaderScript.src = EXOCLICK_POPUNDER_SCRIPT_SRC;
      document.body.appendChild(loaderScript);
    };

    // Ensure download links already exist before ExoClick binds trigger class clicks.
    const triggerSelector = `.${activeTriggerClass}`;

    if (document.querySelector(triggerSelector)) {
      const timer = window.setTimeout(injectScript, 0);
      return () => window.clearTimeout(timer);
    }

    const observer = new MutationObserver(() => {
      if (document.querySelector(triggerSelector)) {
        observer.disconnect();
        injectScript();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const fallbackTimer = window.setTimeout(() => {
      observer.disconnect();
      injectScript();
    }, 5000);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallbackTimer);
    };
  }, [pathname]);

  return null;
}
