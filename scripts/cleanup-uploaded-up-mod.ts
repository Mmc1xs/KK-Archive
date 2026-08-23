import "./load-env";

import fs from "node:fs/promises";
import path from "node:path";
import { db } from "../lib/db";

type ModTableRow = {
  Guid?: string;
  Version?: string;
  Filename?: string;
  Location?: string;
  MessageLink?: string;
  messageLink?: string;
};

type IntakeState = {
  containers?: Array<{
    filename?: string;
    produced?: string[];
  }>;
};

const apply = process.argv.includes("--apply");
const root = process.cwd();
const upModDir = path.join(root, "db mods", "up_mod");
const tablePath = path.join(root, "db mods", "mods_table.json");
const intakeStatePath = path.join(root, "db mods", "up_mod_intake_state.json");

function normalizeFilePath(value: string) {
  return path.resolve(value).replaceAll("/", "\\").toLowerCase();
}

async function main() {
  const entries = await fs.readdir(upModDir, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
  const rows = JSON.parse(await fs.readFile(tablePath, "utf8")) as ModTableRow[];
  const intakeState = await fs
    .readFile(intakeStatePath, "utf8")
    .then((raw) => JSON.parse(raw) as IntakeState)
    .catch(() => ({ containers: [] }) as IntakeState);
  const containers = new Map(
    (intakeState.containers || [])
      .filter((entry) => entry.filename && Array.isArray(entry.produced))
      .map((entry) => [entry.filename!, entry.produced!])
  );
  const eligible: string[] = [];
  const blocked: Array<{ filename: string; reason: string }> = [];

  for (const filename of files) {
    const filePath = path.join(upModDir, filename);
    const normalizedFilePath = normalizeFilePath(filePath);
    const row = rows.find((candidate) => {
      if (candidate.Filename !== filename || !candidate.Location) {
        return false;
      }
      return normalizeFilePath(candidate.Location) === normalizedFilePath;
    });

    if (!row) {
      const produced = containers.get(filename);
      if (!produced?.length) {
        blocked.push({ filename, reason: "matching mods_table row not found" });
        continue;
      }

      let containerReason = "";
      for (const producedFilename of produced) {
        const producedPath = path.join(upModDir, producedFilename);
        const producedRow = rows.find((candidate) => {
          if (candidate.Filename !== producedFilename || !candidate.Location) {
            return false;
          }
          return normalizeFilePath(candidate.Location) === normalizeFilePath(producedPath);
        });
        if (!producedRow) {
          containerReason = `produced row not found: ${producedFilename}`;
          break;
        }
        const producedLink = (producedRow.MessageLink || producedRow.messageLink || "").trim();
        if (!producedLink) {
          containerReason = `produced MessageLink is empty: ${producedFilename}`;
          break;
        }
        const producedDbCount = await db.modLibraryEntry.count({
          where: {
            guid: producedRow.Guid || "",
            version: producedRow.Version || "",
            filename: producedFilename,
            messageLink: producedLink
          }
        });
        if (producedDbCount < 1) {
          containerReason = `produced DB row not found: ${producedFilename}`;
          break;
        }
      }

      if (containerReason) {
        blocked.push({ filename, reason: containerReason });
        continue;
      }
      eligible.push(filePath);
      continue;
    }

    const messageLink = (row.MessageLink || row.messageLink || "").trim();
    if (!messageLink) {
      blocked.push({ filename, reason: "MessageLink is empty" });
      continue;
    }

    const dbCount = await db.modLibraryEntry.count({
      where: {
        guid: row.Guid || "",
        version: row.Version || "",
        filename,
        messageLink
      }
    });

    if (dbCount < 1) {
      blocked.push({ filename, reason: "matching DB row not found" });
      continue;
    }

    eligible.push(filePath);
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        scanned: files.length,
        eligible: eligible.length,
        blocked
      },
      null,
      2
    )
  );

  if (blocked.length > 0) {
    throw new Error("Cleanup blocked because one or more up_mod files are not fully synced");
  }

  if (!apply) {
    return;
  }

  for (const filePath of eligible) {
    await fs.unlink(filePath);
  }

  const remaining = (await fs.readdir(upModDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();

  console.log(JSON.stringify({ deleted: eligible.length, remaining }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
