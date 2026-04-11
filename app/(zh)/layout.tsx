import "./../globals.css";
import { SiteLayoutFrame } from "@/components/site-layout-frame";
import { siteMetadata } from "@/lib/site-metadata";

const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim();

export const metadata = siteMetadata;

export default function ZhLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
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
        <SiteLayoutFrame>{children}</SiteLayoutFrame>
      </body>
    </html>
  );
}
