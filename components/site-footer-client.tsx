"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getCurrentUiLocale,
  getLocaleAboutHref,
  getLocale2257Href,
  getLocaleContactHref,
  getLocaleDmcaHref,
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
  const compliance2257Href = getLocale2257Href(locale);
  const dmcaHref = getLocaleDmcaHref(locale);
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
          compliance2257: "18 USC 2257 声明",
          dmca: "DMCA 下架政策",
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
            compliance2257: "18 USC 2257 声明",
            dmca: "DMCA 削除ポリシー",
            privacy: "プライバシー"
          }
        : {
            madeBy: "Made By Mmc1xs",
            business: "Business Inquiries",
            about: "About",
            contact: "Contact",
            support: "Support Me",
            terms: "Terms",
            compliance2257: "18 USC 2257 Statement",
            dmca: "DMCA Policy",
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
        <Link href={compliance2257Href} className="site-footer-link">
          {labels.compliance2257}
        </Link>
        <Link href={dmcaHref} className="site-footer-link">
          {labels.dmca}
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
