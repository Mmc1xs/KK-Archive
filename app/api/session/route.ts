import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentSession({ touchActivity: false });

  return NextResponse.json({
    user: user
      ? {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role
        }
      : null
  }, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
