"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  getCurrentUiLocale,
  getLocaleContentsHref,
  getLocaleHomeHref,
  getLocaleLoginHref,
  getLocaleProfileHref,
  getLocaleRegisterHref,
  getLocaleSearchHref,
  UI_LOCALES
} from "@/lib/ui-locale";

type SessionUser = {
  id: number;
  email: string;
  username: string | null;
  role: "ADMIN" | "AUDIT" | "MEMBER";
};

const localeLabels = {
  en: {
    short: "EN",
    menu: "English",
    contents: "Contents",
    search: "Search",
    admin: "Admin",
    profile: "Profile",
    logout: "Logout",
    login: "Login",
    register: "Register"
  },
  "zh-CN": {
    short: "中文",
    menu: "中文",
    contents: "内容",
    search: "搜索",
    admin: "管理",
    profile: "个人档案",
    logout: "登出",
    login: "登录",
    register: "注册"
  },
  ja: {
    short: "日本語",
    menu: "日本語",
    contents: "コンテンツ",
    search: "検索",
    admin: "管理",
    profile: "プロフィール",
    logout: "ログアウト",
    login: "ログイン",
    register: "登録"
  }
} as const;

export function SiteNavClient() {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [resolved, setResolved] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const locale = getCurrentUiLocale(pathname);
  const labels = localeLabels[locale];

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/session", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store"
        });

        if (!response.ok) {
          if (active) {
            setResolved(true);
          }
          return;
        }

        const data = (await response.json()) as { user: SessionUser | null };
        if (active) {
          setUser(data.user ?? null);
          setResolved(true);
        }
      } catch {
        if (active) {
          setResolved(true);
        }
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!languageMenuRef.current?.contains(event.target as Node)) {
        setLanguageMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setLanguageMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <>
      <div className="site-nav-links">
        <Link href={getLocaleHomeHref(locale)} className="brand">
          KK Archive
        </Link>
        <Link href={getLocaleContentsHref(locale)}>{labels.contents}</Link>
        <Link href={getLocaleSearchHref(locale)}>{labels.search}</Link>
        {user && (user.role === "ADMIN" || user.role === "AUDIT") ? <Link href="/admin">{labels.admin}</Link> : null}
      </div>
      <div className="inline-actions">
        <div ref={languageMenuRef} style={{ position: "relative", zIndex: 80 }}>
          <button
            type="button"
            className="link-pill"
            onClick={() => setLanguageMenuOpen((current) => !current)}
            aria-haspopup="menu"
            aria-expanded={languageMenuOpen}
          >
            {`${labels.short} ▾`}
          </button>
          {languageMenuOpen ? (
            <div
              role="menu"
              aria-label="Language selector"
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                minWidth: 148,
                display: "grid",
                gap: 8,
                padding: 10,
                borderRadius: 18,
                border: "1px solid rgba(117, 173, 222, 0.42)",
                background: "rgba(255, 255, 255, 0.98)",
                boxShadow: "0 16px 32px rgba(83, 140, 196, 0.16)",
                zIndex: 9999
              }}
            >
              {UI_LOCALES.map((localeOption) => (
                <Link
                  key={localeOption}
                  href={getLocaleHomeHref(localeOption)}
                  role="menuitem"
                  className={localeOption === locale ? "button secondary" : "link-pill"}
                  onClick={() => setLanguageMenuOpen(false)}
                  style={{ justifyContent: "center" }}
                >
                  {localeLabels[localeOption].menu}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
        {resolved && user ? (
          <>
            <Link href={getLocaleProfileHref(locale)} className="link-pill">
              {labels.profile}
            </Link>
            <span className="muted">{user.username ?? user.email}</span>
            <form action="/auth/logout" method="post">
              <button type="submit" className="link-pill">
                {labels.logout}
              </button>
            </form>
          </>
        ) : resolved ? (
          <>
            <Link href={getLocaleLoginHref(locale)} className="link-pill">
              {labels.login}
            </Link>
            <Link href={getLocaleRegisterHref(locale)} className="button">
              {labels.register}
            </Link>
          </>
        ) : (
          <span className="muted">...</span>
        )}
      </div>
    </>
  );
}
