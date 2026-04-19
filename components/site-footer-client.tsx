"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getCurrentUiLocale,
  getLocaleAboutHref,
  getLocaleContactHref,
  getLocalePrivacyHref,
  getLocaleSupportHref,
  getLocaleTermsHref
} from "@/lib/ui-locale";

export function SiteFooterClient() {
  const pathname = usePathname();
  const locale = getCurrentUiLocale(pathname);
  const aboutHref = getLocaleAboutHref(locale);
  const contactHref = getLocaleContactHref(locale);
  const supportHref = getLocaleSupportHref(locale);
  const termsHref = getLocaleTermsHref(locale);
  const privacyHref = getLocalePrivacyHref(locale);
  const labels =
    locale === "zh-CN"
      ? {
          madeBy: "Made By Mmc1xs",
          business: "商务联系",
          about: "关于",
          contact: "联系",
          support: "支持我",
          terms: "使用条款",
          privacy: "隐私"
        }
      : locale === "ja"
        ? {
            madeBy: "Made By Mmc1xs",
            business: "ビジネスお問い合わせ",
            about: "概要",
            contact: "お問い合わせ",
            support: "サポート",
            terms: "利用規約",
            privacy: "プライバシー"
          }
        : {
            madeBy: "Made By Mmc1xs",
            business: "Business Inquiries",
            about: "About",
            contact: "Contact",
            support: "Support Me",
            terms: "Terms",
            privacy: "Privacy"
          };

  return (
    <div className="site-footer-inner">
      <span className="muted">KK Archive</span>
      <div className="site-footer-links">
        <span className="site-footer-link muted">{labels.madeBy}</span>
        <a href="mailto:mmc1xs@koikatsucards.com" className="site-footer-link">
          {labels.business}
        </a>
        <Link href={aboutHref} className="site-footer-link">
          {labels.about}
        </Link>
        <Link href={contactHref} className="site-footer-link">
          {labels.contact}
        </Link>
        <Link href={termsHref} className="site-footer-link">
          {labels.terms}
        </Link>
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
