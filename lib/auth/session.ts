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
    return null;
  }

  const payload = JSON.parse(Buffer.from(raw, "base64url").toString()) as SessionPayload;
  if (payload.expiresAt < Date.now()) {
    return null;
  }
  return payload;
}

export async function createSession(userId: number, role: UserRole) {
  const payload: SessionPayload = {
    userId,
    role,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7
  };

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, encodeSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(payload.expiresAt)
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentSession() {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE_NAME)?.value;
  if (!value) {
    return null;
  }

  const payload = decodeSession(value);
  if (!payload) {
    return null;
  }

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
    await clearSession();
    return null;
  }

  if (user) {
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
