import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { buildGoogleAuthorizationUrl, createGoogleState } from "@/lib/auth/google";
import { GOOGLE_STATE_COOKIE_NAME } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const state = createGoogleState();
    const store = await cookies();

    store.set(GOOGLE_STATE_COOKIE_NAME, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10
    });

    return NextResponse.redirect(buildGoogleAuthorizationUrl(state));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google sign-in is unavailable";
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, request.url));
  }
}
