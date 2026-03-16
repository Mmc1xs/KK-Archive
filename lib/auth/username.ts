import { db } from "@/lib/db";

function normalizeUsernameSeed(value: string) {
  const base = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);

  return base || "member";
}

export async function generateUniqueUsername(seed: string) {
  const base = normalizeUsernameSeed(seed);
  let username = base;
  let counter = 2;

  while (await db.user.findFirst({ where: { username } })) {
    username = `${base}_${counter}`;
    counter += 1;
  }

  return username;
}

export function getEmailUsernameSeed(email: string) {
  return email.split("@")[0] || "member";
}
