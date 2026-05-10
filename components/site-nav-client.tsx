"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  getCurrentUiLocale,
  getLocaleContentsHref,
  getLocaleHomeHref,
  getLocaleLoginHref,
  getLocaleModLibraryHref,
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

const PLUGIN_DATA_READER_HREF = "/tool-static/PluginDataReader?v=20260413";
const SESSION_CACHE_KEY = "kk_site_nav_session_v1";
const SESSION_CACHE_USER_MAX_AGE_MS = 15 * 60 * 1000;
const SESSION_CACHE_GUEST_MAX_AGE_MS = 30 * 1000;
const LOCALE_PREF_COOKIE_KEY = "kk_locale_pref";
const LOCALE_PREF_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

type SessionSnapshot = {
  user: SessionUser | null;
  updatedAt: number;
};

const localeLabels = {
  en: {
    short: "EN",
    menu: "English",
    contents: "Contents",
    search: "Search",
    tool: "Tool",
    modLibrary: "Mod Library",
    admin: "Admin",
    profile: "Profile",
    logout: "Logout",
    login: "Login",
    register: "Register"
  },
  "zh-CN": {
    short: "中",
    menu: "中文",
    contents: "内容",
    search: "搜索",
    tool: "工具",
    modLibrary: "Mod 库",
    admin: "后台",
    profile: "个人资料",
    logout: "登出",
    login: "登录",
    register: "注册"
  },
  ja: {
    short: "日",
    menu: "日本語",
    contents: "コンテンツ",
    search: "検索",
    tool: "ツール",
    modLibrary: "Mod ライブラリ",
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
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const toolMenuRef = useRef<HTMLDivElement | null>(null);
  const locale = getCurrentUiLocale(pathname);
  const labels = localeLabels[locale];
  const canAccessModLibrary = resolved && Boolean(user);

  useEffect(() => {
    let active = true;

    function loadCachedSnapshot() {
      try {
        const raw = window.localStorage.getItem(SESSION_CACHE_KEY);
        if (!raw) {
          return null;
        }

        const snapshot = JSON.parse(raw) as SessionSnapshot;
        if (!snapshot || typeof snapshot.updatedAt !== "number") {
          return null;
        }

        const age = Date.now() - snapshot.updatedAt;
        const maxAge = snapshot.user ? SESSION_CACHE_USER_MAX_AGE_MS : SESSION_CACHE_GUEST_MAX_AGE_MS;

        if (age > maxAge) {
          return null;
        }

        return snapshot;
      } catch {
        return null;
      }
    }

    function persistSnapshot(snapshot: SessionSnapshot) {
      try {
        window.localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(snapshot));
      } catch {
        // Ignore quota/storage failures.
      }
    }

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
          const nextUser = data.user ?? null;
          setUser(nextUser);
          setResolved(true);
          persistSnapshot({
            user: nextUser,
            updatedAt: Date.now()
          });
        }
      } catch {
        if (active) {
          setResolved(true);
        }
      }
    }

    const cached = loadCachedSnapshot();
    if (cached) {
      setUser(cached.user ?? null);
      setResolved(true);
      return () => {
        active = false;
      };
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, []);

  function persistLocalePreference(localeOption: (typeof UI_LOCALES)[number]) {
    try {
      document.cookie = `${LOCALE_PREF_COOKIE_KEY}=${localeOption}; Max-Age=${LOCALE_PREF_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
    } catch {
      // Ignore cookie write failures.
    }
  }

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!languageMenuRef.current?.contains(target)) {
        setLanguageMenuOpen(false);
      }
      if (!toolMenuRef.current?.contains(target)) {
        setToolMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setLanguageMenuOpen(false);
        setToolMenuOpen(false);
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
        {canAccessModLibrary ? <Link href={getLocaleModLibraryHref(locale)}>{labels.modLibrary}</Link> : null}
        <div ref={toolMenuRef} style={{ position: "relative", zIndex: 80 }}>
          <button
            type="button"
            className="nav-dropdown-trigger"
            onClick={() => {
              setToolMenuOpen((current) => !current);
              setLanguageMenuOpen(false);
            }}
            aria-haspopup="menu"
            aria-expanded={toolMenuOpen}
          >
            <span>{labels.tool}</span>
            <span className="nav-dropdown-caret" aria-hidden="true">
              ▼
            </span>
          </button>
          {toolMenuOpen ? (
            <div
              role="menu"
              aria-label="Tool selector"
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                minWidth: 188,
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
              <Link
                href={PLUGIN_DATA_READER_HREF}
                role="menuitem"
                className="button secondary"
                onClick={() => setToolMenuOpen(false)}
                style={{ justifyContent: "center" }}
              >
                PluginDataReader
              </Link>
            </div>
          ) : null}
        </div>
        {user && (user.role === "ADMIN" || user.role === "AUDIT") ? <Link href="/admin">{labels.admin}</Link> : null}
      </div>
      <div className="inline-actions">
        <div ref={languageMenuRef} style={{ position: "relative", zIndex: 80 }}>
          <button
            type="button"
            className="link-pill"
            onClick={() => {
              setLanguageMenuOpen((current) => !current);
              setToolMenuOpen(false);
            }}
            aria-haspopup="menu"
            aria-expanded={languageMenuOpen}
          >
            {`${labels.short} ▼`}
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
                  onClick={() => {
                    persistLocalePreference(localeOption);
                    setLanguageMenuOpen(false);
                  }}
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
              <button
                type="submit"
                className="link-pill"
                onClick={() => {
                  try {
                    window.localStorage.removeItem(SESSION_CACHE_KEY);
                  } catch {
                    // Ignore storage failures.
                  }
                }}
              >
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
