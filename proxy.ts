import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

export async function proxy(request: NextRequest) {
  const canonicalOrigin = getCanonicalOrigin();
  if (canonicalOrigin && request.nextUrl.origin !== canonicalOrigin) {
    return NextResponse.redirect(new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, canonicalOrigin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
};
