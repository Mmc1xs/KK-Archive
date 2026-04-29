import Script from "next/script";

const EXOCLICK_POPUNDER_ZONE_ID = process.env.NEXT_PUBLIC_EXOCLICK_POPUNDER_ZONE_ID?.trim();
const EXOCLICK_POPUNDER_TRIGGER_CLASS =
  process.env.NEXT_PUBLIC_EXOCLICK_POPUNDER_TRIGGER_CLASS?.trim() || "exo-download-trigger";
const EXOCLICK_POPUNDER_FREQUENCY_PERIOD =
  process.env.NEXT_PUBLIC_EXOCLICK_POPUNDER_FREQUENCY_PERIOD?.trim() || "720";
const EXOCLICK_POPUNDER_FREQUENCY_COUNT =
  process.env.NEXT_PUBLIC_EXOCLICK_POPUNDER_FREQUENCY_COUNT?.trim() || "1";

export function ExoClickPopunder() {
  if (!EXOCLICK_POPUNDER_ZONE_ID) {
    return null;
  }

  return (
    <Script
      id="exoclick-popunder-loader"
      strategy="afterInteractive"
      src="https://a.pemsrv.com/popunder1000.js"
      data-exo-idzone={EXOCLICK_POPUNDER_ZONE_ID}
      data-exo-popup_fallback="false"
      data-exo-popup_force="false"
      data-exo-chrome_enabled="true"
      data-exo-new_tab="false"
      data-exo-frequency_period={EXOCLICK_POPUNDER_FREQUENCY_PERIOD}
      data-exo-frequency_count={EXOCLICK_POPUNDER_FREQUENCY_COUNT}
      data-exo-trigger_method="2"
      data-exo-trigger_class={EXOCLICK_POPUNDER_TRIGGER_CLASS}
      data-exo-trigger_delay="0"
      data-exo-capping_enabled="true"
      data-exo-tcf_enabled="true"
      data-exo-only_inline="false"
    />
  );
}
