"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCurrentUiLocale, getLocalePrivacyHref, getLocaleSupportHref } from "@/lib/ui-locale";

export function SiteFooterClient() {
  const pathname = usePathname();
  const locale = getCurrentUiLocale(pathname);
  const supportHref = getLocaleSupportHref(locale);
  const privacyHref = getLocalePrivacyHref(locale);
  const labels =
    locale === "zh-CN"
      ? {
          business: "商务合作",
          support: "支持我",
          privacy: "隐私权"
        }
      : locale === "ja"
        ? {
            business: "ビジネスお問い合わせ",
            support: "サポート",
            privacy: "プライバシー"
          }
        : {
            business: "Business Inquiries",
            support: "Support Me",
            privacy: "Privacy"
          };

  return (
    <div className="site-footer-inner">
      <span className="muted">KK Archive</span>
      <div className="site-footer-links">
        <span className="site-footer-link muted">Made By Mmc1xs</span>
        <a href="mailto:mmc1xs@koikatsucards.com" className="site-footer-link">
          {labels.business}
        </a>
        <Link href={supportHref} className="site-footer-link">
          {labels.support}
        </Link>
        <Link href={privacyHref} className="site-footer-link">
          {labels.privacy}
        </Link>
      </div>
    </div>
  );
}
