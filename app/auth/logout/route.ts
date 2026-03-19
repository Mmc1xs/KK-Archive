import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  const hostname = new URL(request.url).hostname;
  response.cookies.delete({
    name: SESSION_COOKIE_NAME,
    path: "/",
    ...(hostname === "localhost" || hostname.endsWith(".localhost") ? {} : { domain: hostname })
  });
  return response;
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
