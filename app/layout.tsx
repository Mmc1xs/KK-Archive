import type { Metadata } from "next";
import "./globals.css";
import { SiteFooterClient } from "@/components/site-footer-client";
import { SiteNavClient } from "@/components/site-nav-client";
import { getSiteOrigin } from "@/lib/site-origin";

const siteOrigin = getSiteOrigin();
const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim();

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: "KK Archive | Koikatsu Cards, Presets, Scenes and Shared Files",
  description:
    "A searchable archive for Koikatsu-related files, including cards, presets, scenes, textures, overlays, and other shared resources organized with structured tags.",
  openGraph: {
    title: "KK Archive | Koikatsu Cards, Presets, Scenes and Shared Files",
    description:
      "A searchable archive for Koikatsu-related files, including cards, presets, scenes, textures, overlays, and other shared resources organized with structured tags.",
    url: siteOrigin,
    siteName: "KK Archive",
    locale: "en_US",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {adsenseClientId ? (
          <script
            async
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`}
          />
        ) : null}
      </head>
      <body>
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
      </body>
    </html>
  );
}
