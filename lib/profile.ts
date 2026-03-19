import { UserRole } from "@prisma/client";
import { db } from "@/lib/db";

const USERNAME_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export async function getProfileData(userId: number) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      usernameUpdatedAt: true,
      role: true,
      isSuspended: true,
      createdAt: true,
      settlementQuantity: true
    }
  });

  if (!user) {
    return null;
  }

  const nextUsernameChangeAt = user.usernameUpdatedAt
    ? new Date(user.usernameUpdatedAt.getTime() + USERNAME_CHANGE_COOLDOWN_MS)
    : null;
  const canChangeUsername = !nextUsernameChangeAt || nextUsernameChangeAt.getTime() <= Date.now();

  const [editedCount, passedCount] = await Promise.all([
    db.content.count({
      where: {
        firstEditedByUserId: user.id
      }
    }),
    user.role === UserRole.ADMIN
      ? db.content.count({
          where: {
            passedByUserId: user.id
          }
        })
      : Promise.resolve(0)
  ]);

  return {
    user,
    usernameChange: {
      canChange: canChangeUsername,
      nextAvailableAt: canChangeUsername ? null : nextUsernameChangeAt
    },
    metrics: {
      editedCount,
      passedCount,
      settlementQuantity: user.settlementQuantity
    }
  };
}
