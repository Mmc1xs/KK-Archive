import { UserRole } from "@prisma/client";
import { db } from "@/lib/db";

export async function getProfileData(userId: number) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      isSuspended: true,
      createdAt: true,
      settlementQuantity: true
    }
  });

  if (!user) {
    return null;
  }

  const [editedCount, passedCount] = await Promise.all([
    db.content.count({
      where: {
        editedByUserId: user.id
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
    metrics: {
      editedCount,
      passedCount,
      settlementQuantity: user.settlementQuantity
    }
  };
}
