import "./load-env";
import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";
import { spawnSync } from "child_process";

type PostJson = {
  source?: {
    telegramPostUrl?: string | null;
    pixivArtworkUrl?: string | null;
  };
  post?: {
    sourceLink?: string | null;
  };
};

function escapeSql(value: string) {
  return value.replace(/'/g, "''");
}

function buildUpdateStatement(telegramPostUrl: string, sourceLink: string | null) {
  const sourceValue = sourceLink ? `'${escapeSql(sourceLink)}'` : "NULL";
  const telegramValue = `'${escapeSql(telegramPostUrl)}'`;

  return `
UPDATE contents
SET source_link = ${sourceValue}
WHERE id IN (
  SELECT c.id
  FROM contents c
  INNER JOIN content_download_links d ON d.content_id = c.id
  WHERE d.url = ${telegramValue}
);
`.trim();
}

function main() {
  const cleanRoot = path.resolve(process.cwd(), process.env.CLEAN_IMAGE_ROOT || "db image/clean");
  if (!existsSync(cleanRoot)) {
    throw new Error(`Clean root not found: ${cleanRoot}`);
  }

  const folders = readdirSync(cleanRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const statements: string[] = [];
  let matched = 0;

  for (const folder of folders) {
    const postPath = path.join(cleanRoot, folder.name, "post.json");
    if (!existsSync(postPath)) {
      continue;
    }

    const post = JSON.parse(readFileSync(postPath, "utf8")) as PostJson;
    const telegramPostUrl = post.source?.telegramPostUrl?.trim();
    if (!telegramPostUrl) {
      continue;
    }

    const sourceLink = post.post?.sourceLink?.trim() || post.source?.pixivArtworkUrl?.trim() || null;
    statements.push(buildUpdateStatement(telegramPostUrl, sourceLink));
    matched += 1;
  }

  if (!statements.length) {
    console.log(JSON.stringify({ updatedTargets: 0, executed: false }, null, 2));
    return;
  }

  const sql = statements.join("\n\n");
  const result = spawnSync(
    "npx",
    ["prisma", "db", "execute", "--schema", "prisma/schema.postgres.prisma", "--stdin"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      input: sql,
      shell: process.platform === "win32"
    }
  );

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "Source link backfill failed").trim());
  }

  console.log(
    JSON.stringify(
      {
        updatedTargets: matched,
        executed: true
      },
      null,
      2
    )
  );
}

main();
