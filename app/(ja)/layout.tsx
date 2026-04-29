import "./../globals.css";
import { SiteLayoutFrame } from "@/components/site-layout-frame";
import { siteMetadata } from "@/lib/site-metadata";

const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim();
const exoclickSiteVerificationContent = "40226c3539e60356f7b0eacdff410a11";

export const metadata = siteMetadata;

export default function JaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <head>
        <meta name="6a97888e-site-verification" content={exoclickSiteVerificationContent} />
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
