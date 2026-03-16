import "./load-env";

import { PrismaClient as SqlitePrismaClient } from "../generated/sqlite-client";
import { PrismaClient as PostgresPrismaClient } from "../generated/postgres-client";

const sqlite = new SqlitePrismaClient();
const postgres = new PostgresPrismaClient();

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function syncSequence(tableName: string, columnName = "id") {
  const query = `
    SELECT setval(
      pg_get_serial_sequence('"${tableName}"', '${columnName}'),
      COALESCE((SELECT MAX("${columnName}") FROM "${tableName}"), 1),
      EXISTS (SELECT 1 FROM "${tableName}")
    )
  `;

  await postgres.$executeRawUnsafe(query);
}

async function main() {
  requireEnv("DATABASE_URL");
  requireEnv("POSTGRES_POOLED_URL");
  requireEnv("POSTGRES_SESSION_URL");

  const [
    users,
    userLoginEvents,
    contents,
    contentImages,
    contentDownloadLinks,
    tags,
    contentTags
  ] = await Promise.all([
    sqlite.user.findMany({ orderBy: { id: "asc" } }),
    sqlite.userLoginEvent.findMany({ orderBy: { id: "asc" } }),
    sqlite.content.findMany({ orderBy: { id: "asc" } }),
    sqlite.contentImage.findMany({ orderBy: { id: "asc" } }),
    sqlite.contentDownloadLink.findMany({ orderBy: { id: "asc" } }),
    sqlite.tag.findMany({ orderBy: { id: "asc" } }),
    sqlite.contentTag.findMany({
      orderBy: [{ contentId: "asc" }, { tagId: "asc" }]
    })
  ]);

  await postgres.$transaction(async (tx) => {
    await tx.contentTag.deleteMany();
    await tx.contentDownloadLink.deleteMany();
    await tx.contentImage.deleteMany();
    await tx.userLoginEvent.deleteMany();
    await tx.content.deleteMany();
    await tx.tag.deleteMany();
    await tx.user.deleteMany();

    if (users.length > 0) {
      await tx.user.createMany({ data: users });
    }

    if (tags.length > 0) {
      await tx.tag.createMany({ data: tags });
    }

    if (contents.length > 0) {
      await tx.content.createMany({ data: contents });
    }

    if (userLoginEvents.length > 0) {
      await tx.userLoginEvent.createMany({ data: userLoginEvents });
    }

    if (contentImages.length > 0) {
      await tx.contentImage.createMany({ data: contentImages });
    }

    if (contentDownloadLinks.length > 0) {
      await tx.contentDownloadLink.createMany({ data: contentDownloadLinks });
    }

    if (contentTags.length > 0) {
      await tx.contentTag.createMany({ data: contentTags });
    }
  });

  await syncSequence("users");
  await syncSequence("user_login_events");
  await syncSequence("contents");
  await syncSequence("content_images");
  await syncSequence("content_download_links");
  await syncSequence("tags");

  console.log("SQLite -> Postgres migration completed.");
  console.log(
    JSON.stringify(
      {
        users: users.length,
        userLoginEvents: userLoginEvents.length,
        contents: contents.length,
        contentImages: contentImages.length,
        contentDownloadLinks: contentDownloadLinks.length,
        tags: tags.length,
        contentTags: contentTags.length
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await sqlite.$disconnect();
    await postgres.$disconnect();
  });
