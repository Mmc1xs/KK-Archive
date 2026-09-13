import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession, getSessionPresenceCookieOptions } from "@/lib/auth/session";
import { SESSION_PRESENCE_COOKIE_NAME } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentSession({ touchActivity: false });
  const response = NextResponse.json(
    {
      user: user
        ? {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role
          }
        : null
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );

  const hostname = request.nextUrl.hostname;
  if (user) {
    response.cookies.set(SESSION_PRESENCE_COOKIE_NAME, "1", getSessionPresenceCookieOptions(undefined, hostname));
  } else {
    response.cookies.delete({
      name: SESSION_PRESENCE_COOKIE_NAME,
      path: "/",
      ...(hostname === "localhost" || hostname.endsWith(".localhost") ? {} : { domain: hostname })
    });
  }

  return response;
}
