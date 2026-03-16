import { db } from "@/lib/db";

const LAST_SEEN_TOUCH_WINDOW_MS = 1000 * 60 * 10;

export async function recordUserLogin(userId: number, provider: string) {
  const now = new Date();

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: now,
        lastSeenAt: now,
        loginCount: {
          increment: 1
        }
      }
    }),
    db.userLoginEvent.create({
      data: {
        userId,
        provider
      }
    })
  ]);
}

export async function touchUserActivity(userId: number) {
  const threshold = new Date(Date.now() - LAST_SEEN_TOUCH_WINDOW_MS);

  await db.user.updateMany({
    where: {
      id: userId,
      OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: threshold } }]
    },
    data: {
      lastSeenAt: new Date()
    }
  });
}
