import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import "./globals.css";
import { getCurrentSession, clearSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "KK Archive | Koikatsu Cards, Presets, Scenes and Shared Files",
  description:
    "A searchable archive for Koikatsu-related files, including cards, presets, scenes, textures, overlays, and other shared resources organized with structured tags."
};

async function logoutAction() {
  "use server";
  await clearSession();
  redirect("/");
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentSession();

  return (
    <html lang="zh-Hant">
      <body>
        <header className="site-header">
          <div className="shell">
            <nav className="site-nav">
              <div className="site-nav-links">
                <Link href="/" className="brand">
                  KK Archive
                </Link>
                <Link href="/contents">Contents</Link>
                <Link href="/search">Search</Link>
                {user && (user.role === "ADMIN" || user.role === "AUDIT") ? <Link href="/admin">Admin</Link> : null}
              </div>
              <div className="inline-actions">
                {user ? (
                  <>
                    <span className="muted">{user.username ?? user.email}</span>
                    <form action={logoutAction}>
                      <button type="submit" className="link-pill">
                        Logout
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="link-pill">
                      Login
                    </Link>
                    <Link href="/register" className="button">
                      Register
                    </Link>
                  </>
                )}
              </div>
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
