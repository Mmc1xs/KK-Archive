import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

function withSupabasePoolerCompatibility(url?: string) {
  if (!url) {
    return url;
  }

  try {
    const parsed = new URL(url);

    if (!parsed.hostname.includes(".pooler.supabase.com")) {
      return url;
    }

    // Only transaction pooler connections need the Prisma pgbouncer flags.
    if (parsed.port !== "6543") {
      return url;
    }

    if (!parsed.searchParams.has("pgbouncer")) {
      parsed.searchParams.set("pgbouncer", "true");
    }

    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set("connection_limit", "1");
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

function getRuntimeDatabaseUrl() {
  if (process.env.NODE_ENV === "production") {
    return withSupabasePoolerCompatibility(process.env.POSTGRES_POOLED_URL);
  }

  return (
    process.env.POSTGRES_SESSION_URL ||
    process.env.POSTGRES_DIRECT_URL ||
    withSupabasePoolerCompatibility(process.env.POSTGRES_POOLED_URL)
  );
}

const runtimeDatabaseUrl = getRuntimeDatabaseUrl();

export const db =
  global.prisma ??
  new PrismaClient({
    log: ["error"],
    ...(runtimeDatabaseUrl
      ? {
          datasources: {
            db: {
              url: runtimeDatabaseUrl
            }
          }
        }
      : {})
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = db;
}
