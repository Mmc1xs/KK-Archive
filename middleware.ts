import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

function getCanonicalOrigin() {
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!redirectUri) {
    return null;
  }

  try {
    return new URL(redirectUri).origin;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const canonicalOrigin = getCanonicalOrigin();
  if (canonicalOrigin && request.nextUrl.origin !== canonicalOrigin) {
    return NextResponse.redirect(new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, canonicalOrigin));
  }

  if (!request.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const session = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
};
