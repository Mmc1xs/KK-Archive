import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/session";

export async function SiteNavClient() {
  const user = await getCurrentSession({ touchActivity: false });

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
    </>
  );
}
