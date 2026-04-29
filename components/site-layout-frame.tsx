import { Suspense } from "react";
import { ExoClickPopunder } from "@/components/exoclick-popunder";
import { GoogleAnalytics } from "@/components/google-analytics";
import { SiteFooterClient } from "@/components/site-footer-client";
import { SiteNavClient } from "@/components/site-nav-client";

const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

export function SiteLayoutFrame({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {gaMeasurementId ? (
        <Suspense fallback={null}>
          <GoogleAnalytics measurementId={gaMeasurementId} />
        </Suspense>
      ) : null}
      <ExoClickPopunder />
      <header className="site-header">
        <div className="shell">
          <nav className="site-nav" style={{ position: "relative", zIndex: 60, overflow: "visible" }}>
            <SiteNavClient />
          </nav>
        </div>
      </header>
      <main className="shell">{children}</main>
      <footer className="site-footer">
        <div className="shell">
          <SiteFooterClient />
        </div>
      </footer>
    </>
  );
}
