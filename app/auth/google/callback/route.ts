import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { recordUserLogin } from "@/lib/auth/activity";
import { enforceUserLoginThreshold } from "@/lib/admin/activity";
import { getSessionCookieOptions, getSessionCookieValue } from "@/lib/auth/session";
import { getEmailUsernameSeed, generateUniqueUsername } from "@/lib/auth/username";
import { db } from "@/lib/db";
import { exchangeGoogleCode, fetchGoogleUserInfo, getGoogleRedirectUri, sanitizeGoogleEmail } from "@/lib/auth/google";
import { GOOGLE_STATE_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/constants";

function redirectWithError(request: NextRequest, message: string) {
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, request.url));
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return redirectWithError(request, "Google sign-in was cancelled");
  }

  if (!code || !state) {
    return redirectWithError(request, "Missing Google sign-in response");
  }

  const store = await cookies();
  const storedState = store.get(GOOGLE_STATE_COOKIE_NAME)?.value;

  if (!storedState || storedState !== state) {
    return redirectWithError(request, "Google sign-in state mismatch");
  }

  try {
    if (!getGoogleRedirectUri()) {
      return redirectWithError(request, "Google sign-in is not configured");
    }

    const token = await exchangeGoogleCode(code);
    const profile = await fetchGoogleUserInfo(token.access_token);

    if (!profile.email || !profile.email_verified) {
      return redirectWithError(request, "Only Google-verified email accounts can sign in");
    }

    const email = sanitizeGoogleEmail(profile.email);

    const existingByGoogleId = await db.user.findUnique({
      where: { googleId: profile.sub }
    });

    let user = existingByGoogleId;

    if (!user) {
      const existingByEmail = await db.user.findUnique({
        where: { email }
      });

      if (existingByEmail) {
        if (existingByEmail.googleId && existingByEmail.googleId !== profile.sub) {
          return redirectWithError(request, "This email is already linked to another Google account");
        }

        user = await db.user.update({
          where: { id: existingByEmail.id },
          data: {
            googleId: profile.sub,
            googleEmailVerified: true,
            email,
            username: existingByEmail.username ?? (await generateUniqueUsername(getEmailUsernameSeed(email)))
          }
        });
      } else {
        user = await db.user.create({
          data: {
            email,
            username: await generateUniqueUsername(getEmailUsernameSeed(email)),
            googleId: profile.sub,
            googleEmailVerified: true,
            role: UserRole.MEMBER
          }
        });
      }
    } else if (!user.googleEmailVerified) {
      user = await db.user.update({
        where: { id: user.id },
        data: {
          googleEmailVerified: true,
          email,
          username: user.username ?? (await generateUniqueUsername(getEmailUsernameSeed(email)))
        }
      });
    }

    if (user.isSuspended) {
      return redirectWithError(request, "This account has been suspended by an administrator.");
    }

    const thresholdResult = await enforceUserLoginThreshold(user.id);
    if (!thresholdResult.allowed) {
      return redirectWithError(request, thresholdResult.reason);
    }

    await recordUserLogin(user.id, "google");
    const response = NextResponse.redirect(new URL(user.role === UserRole.ADMIN ? "/admin" : "/", request.url));
    response.cookies.set(
      SESSION_COOKIE_NAME,
      getSessionCookieValue(user.id, user.role),
      getSessionCookieOptions(Date.now() + 1000 * 60 * 60 * 24 * 7)
    );
    response.cookies.delete(GOOGLE_STATE_COOKIE_NAME);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google sign-in failed";
    return redirectWithError(request, message);
  }
}
