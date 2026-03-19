"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SessionUser = {
  id: number;
  email: string;
  username: string | null;
  role: "ADMIN" | "AUDIT" | "MEMBER";
};

export function SiteNavClient() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/session", {
          credentials: "same-origin",
          cache: "no-store"
        });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { user: SessionUser | null };
        if (active) {
          setUser(data.user);
        }
      } finally {
        if (active) {
          setLoaded(true);
        }
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
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
            <Link href="/profile" className="link-pill">
              Profile
            </Link>
            <span className="muted">{user.username ?? user.email}</span>
            <form action="/auth/logout" method="post">
              <button type="submit" className="link-pill">
                Logout
              </button>
            </form>
          </>
        ) : loaded ? (
          <>
            <Link href="/login" className="link-pill">
              Login
            </Link>
            <Link href="/register" className="button">
              Register
            </Link>
          </>
        ) : (
          <>
            <span className="muted">Loading...</span>
          </>
        )}
      </div>
    </>
  );
}
