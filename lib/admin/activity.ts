import { UserRole } from "@prisma/client";
import { db } from "@/lib/db";

export const ELEVATED_LOGIN_THRESHOLD_24H = 8;
export const HIGH_RISK_LOGIN_THRESHOLD_24H = 15;
export const AUTO_SUSPEND_LOGIN_THRESHOLD_24H = 30;

export type RiskLevel = "normal" | "elevated" | "high" | "suspended";

export type AccountActivityRow = {
  id: number;
  username: string | null;
  email: string;
  role: UserRole;
  loginCount: number;
  lastLoginAt: Date | null;
  lastSeenAt: Date | null;
  isSuspended: boolean;
  suspendedAt: Date | null;
  logins24h: number;
  riskLevel: RiskLevel;
};

export type AccountActivityAnalytics = {
  summary: {
    totalMembers: number;
    activeUsers24h: number;
    signIns24h: number;
    signIns7d: number;
    suspiciousUsers24h: number;
    suspendedUsers: number;
  };
  topActiveUsers: AccountActivityRow[];
  recentSignIns: Array<{
    id: number;
    username: string | null;
    email: string;
    role: UserRole;
    provider: string;
    createdAt: Date;
  }>;
};

function getRiskLevel(logins24h: number, isSuspended: boolean): RiskLevel {
  if (isSuspended) {
    return "suspended";
  }

  if (logins24h >= HIGH_RISK_LOGIN_THRESHOLD_24H) {
    return "high";
  }

  if (logins24h >= ELEVATED_LOGIN_THRESHOLD_24H) {
    return "elevated";
  }

  return "normal";
}

function buildActivityRows(
  users: Array<{
    id: number;
    username: string | null;
    email: string;
    role: UserRole;
    loginCount: number;
    lastLoginAt: Date | null;
    lastSeenAt: Date | null;
    isSuspended: boolean;
    suspendedAt: Date | null;
  }>,
  logins24hByUser: Map<number, number>
) {
  return users.map((user) => {
    const logins24h = logins24hByUser.get(user.id) ?? 0;

    return {
      ...user,
      logins24h,
      riskLevel: getRiskLevel(logins24h, user.isSuspended)
    };
  });
}

export async function enforceUserLoginThreshold(userId: number) {
  const now = Date.now();
  const since24h = new Date(now - 1000 * 60 * 60 * 24);
  const loginEvents24h = await db.userLoginEvent.count({
    where: {
      userId,
      createdAt: {
        gte: since24h
      }
    }
  });

  const projectedCount = loginEvents24h + 1;

  if (projectedCount >= AUTO_SUSPEND_LOGIN_THRESHOLD_24H) {
    await db.user.update({
      where: { id: userId },
      data: {
        isSuspended: true,
        suspendedAt: new Date()
      }
    });

    return {
      allowed: false as const,
      reason: "This account was automatically suspended because its login activity exceeded the safety threshold."
    };
  }

  return {
    allowed: true as const,
    projectedCount
  };
}

export async function getAccountActivityAnalytics(): Promise<AccountActivityAnalytics> {
  const now = Date.now();
  const since24h = new Date(now - 1000 * 60 * 60 * 24);
  const since7d = new Date(now - 1000 * 60 * 60 * 24 * 7);

  const totalMembers = await db.user.count({
    where: {
      role: UserRole.MEMBER
    }
  });

  const activeUsers24h = await db.user.count({
    where: {
      lastSeenAt: {
        gte: since24h
      }
    }
  });

  const signIns24h = await db.userLoginEvent.count({
    where: {
      createdAt: {
        gte: since24h
      }
    }
  });

  const signIns7d = await db.userLoginEvent.count({
    where: {
      createdAt: {
        gte: since7d
      }
    }
  });

  const suspendedUsers = await db.user.count({
    where: {
      isSuspended: true
    }
  });

  const grouped24h = await db.userLoginEvent.groupBy({
    by: ["userId"],
    where: {
      createdAt: {
        gte: since24h
      }
    },
    _count: {
      _all: true
    }
  });

  const users = await db.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      loginCount: true,
      lastLoginAt: true,
      lastSeenAt: true,
      isSuspended: true,
      suspendedAt: true
    },
    orderBy: [{ lastSeenAt: "desc" }, { loginCount: "desc" }],
    take: 12
  });

  const recentSignIns = await db.userLoginEvent.findMany({
    take: 12,
    orderBy: {
      createdAt: "desc"
    },
    include: {
      user: {
        select: {
          username: true,
          email: true,
          role: true
        }
      }
    }
  });

  const logins24hByUser = new Map(grouped24h.map((item) => [item.userId, item._count._all]));

  return {
    summary: {
      totalMembers,
      activeUsers24h,
      signIns24h,
      signIns7d,
      suspiciousUsers24h: grouped24h.filter((item) => item._count._all >= HIGH_RISK_LOGIN_THRESHOLD_24H).length,
      suspendedUsers
    },
    topActiveUsers: buildActivityRows(users, logins24hByUser),
    recentSignIns: recentSignIns.map((event) => ({
      id: event.id,
      username: event.user.username,
      email: event.user.email,
      role: event.user.role,
      provider: event.provider,
      createdAt: event.createdAt
    }))
  };
}

export async function getAccountActivityPageData() {
  const since24h = new Date(Date.now() - 1000 * 60 * 60 * 24);

  const analytics = await getAccountActivityAnalytics();
  const grouped24h = await db.userLoginEvent.groupBy({
    by: ["userId"],
    where: {
      createdAt: {
        gte: since24h
      }
    },
    _count: {
      _all: true
    }
  });
  const users = await db.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      loginCount: true,
      lastLoginAt: true,
      lastSeenAt: true,
      isSuspended: true,
      suspendedAt: true
    },
    orderBy: [{ isSuspended: "desc" }, { lastSeenAt: "desc" }, { email: "asc" }]
  });
  const recentEvents = await db.userLoginEvent.findMany({
    take: 40,
    orderBy: {
      createdAt: "desc"
    },
    include: {
      user: {
        select: {
          username: true,
          email: true,
          role: true
        }
      }
    }
  });

  const logins24hByUser = new Map(grouped24h.map((item) => [item.userId, item._count._all]));

  return {
    analytics,
    users: buildActivityRows(users, logins24hByUser),
    events: recentEvents.map((event) => ({
      id: event.id,
      username: event.user.username,
      email: event.user.email,
      role: event.user.role,
      provider: event.provider,
      createdAt: event.createdAt
    }))
  };
}
