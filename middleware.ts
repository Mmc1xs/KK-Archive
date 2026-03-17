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

async function sign(value: string) {
  const secret = process.env.SESSION_SECRET || "dev-secret-change-me";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return atob(padded);
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

  const [raw, signature] = session.split(".");
  if (!raw || !signature || (await sign(raw)) !== signature) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const payload = JSON.parse(decodeBase64Url(raw)) as {
      role: string;
      expiresAt: number;
    };

    if (payload.expiresAt < Date.now()) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (payload.role !== "ADMIN" && payload.role !== "AUDIT") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
};
