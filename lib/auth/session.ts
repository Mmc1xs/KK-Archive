import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { touchUserActivity } from "@/lib/auth/activity";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
import { db } from "@/lib/db";

type SessionPayload = {
  userId: number;
  role: UserRole;
  expiresAt: number;
};

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getSessionSecret() {
  const value = process.env.SESSION_SECRET;
  if (value) {
    return value;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing required environment variable: SESSION_SECRET");
  }

  return "dev-secret-change-me";
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("hex");
}

function encodeSession(payload: SessionPayload) {
  const raw = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(raw);
  return `${raw}.${signature}`;
}

function buildSessionPayload(userId: number, role: UserRole): SessionPayload {
  return {
    userId,
    role,
    expiresAt: Date.now() + 1000 * SESSION_MAX_AGE_SECONDS
  };
}

export function getSessionCookieValue(userId: number, role: UserRole) {
  return encodeSession(buildSessionPayload(userId, role));
}

function normalizeCookieDomain(domain?: string) {
  if (!domain || domain === "localhost" || domain.endsWith(".localhost")) {
    return undefined;
  }

  return domain;
}

export function getSessionCookieOptions(expiresAt?: number, domain?: string) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    priority: "high" as const,
    ...(normalizeCookieDomain(domain) ? { domain: normalizeCookieDomain(domain) } : {}),
    ...(expiresAt ? { expires: new Date(expiresAt) } : {})
  };
}

function decodeSession(value: string): SessionPayload | null {
  const [raw, signature] = value.split(".");
  if (!raw || !signature) {
    return null;
  }

  const expected = sign(raw);
  const isValid =
    Buffer.byteLength(signature) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

  if (!isValid) {
    console.warn("[auth] Session signature validation failed.");
    return null;
  }

  const payload = JSON.parse(Buffer.from(raw, "base64url").toString()) as SessionPayload;
  if (payload.expiresAt < Date.now()) {
    return null;
  }
  return payload;
}

export async function createSession(userId: number, role: UserRole) {
  const payload = buildSessionPayload(userId, role);

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, encodeSession(payload), getSessionCookieOptions(payload.expiresAt));
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentSession(options?: { touchActivity?: boolean }) {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE_NAME)?.value;
  if (!value) {
    console.warn("[auth] No session cookie present on request.");
    return null;
  }

  console.info("[auth] Session cookie detected.", {
    cookieName: SESSION_COOKIE_NAME,
    valueLength: value.length
  });

  const payload = decodeSession(value);
  if (!payload) {
    console.warn("[auth] Session cookie could not be decoded.");
    return null;
  }

  console.info("[auth] Session payload decoded.", {
    userId: payload.userId,
    role: payload.role,
    expiresAt: payload.expiresAt
  });

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      isSuspended: true
    }
  });

  if (user?.isSuspended) {
    console.warn("[auth] Session belongs to suspended user.", { userId: user.id });
    await clearSession();
    return null;
  }

  if (!user) {
    console.warn("[auth] Session user not found in database.", { userId: payload.userId });
    return null;
  }

  if (user && options?.touchActivity !== false) {
    await touchUserActivity(user.id);
  }

  return user;
}

export async function requireUser() {
  const user = await getCurrentSession();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) {
    redirect("/");
  }
  return user;
}

export async function requireStaff() {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.AUDIT) {
    redirect("/");
  }
  return user;
}
