import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SiteNavClient } from "@/components/site-nav-client";
import { getSiteOrigin } from "@/lib/site-origin";

const siteOrigin = getSiteOrigin();

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: "KK Archive | Koikatsu Cards, Presets, Scenes and Shared Files",
  description:
    "A searchable archive for Koikatsu-related files, including cards, presets, scenes, textures, overlays, and other shared resources organized with structured tags.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "KK Archive | Koikatsu Cards, Presets, Scenes and Shared Files",
    description:
      "A searchable archive for Koikatsu-related files, including cards, presets, scenes, textures, overlays, and other shared resources organized with structured tags.",
    url: siteOrigin,
    siteName: "KK Archive",
    locale: "zh_TW",
    type: "website"
  }
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>
        <header className="site-header">
          <div className="shell">
            <nav className="site-nav">
              <SiteNavClient />
            </nav>
          </div>
        </header>
        <main className="shell">{children}</main>
        <footer className="site-footer">
          <div className="shell">
            <div className="site-footer-inner">
              <span className="muted">KK Archive</span>
              <Link href="/privacy" className="site-footer-link">
                Privacy
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
