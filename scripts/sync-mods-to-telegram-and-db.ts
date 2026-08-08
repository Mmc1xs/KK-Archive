import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { db } from "../lib/db";
import { dbImageRoot, dbModsRoot, siteRoot } from "./workflow-paths";

type ModTableRow = {
  Name: string;
  Version: string;
  Author: string;
  Guid: string;
  Filename: string;
  Location?: string;
  MessageLink?: string;
  messageLink?: string;
};

type UploadStateEntry = {
  key: string;
  status: "success" | "failed" | "pending";
  attempts: number;
  lastAttemptAt: string;
  lastError?: string;
  messageId?: number;
  messageLink?: string;
  bytes?: number;
};

type UploadState = {
  version: 1;
  channel: string;
  updatedAt: string;
  entries: Record<string, UploadStateEntry>;
};

type CompensationTask = {
  id: string;
  createdAt: string;
  stage: "mods_table_write_failed" | "db_upsert_failed";
  key: string;
  name: string;
  version: string;
  author: string;
  guid: string;
  filename: string;
  location?: string;
  messageLink: string;
  messageId?: number;
  error: string;
};

type CompensationQueue = {
  version: 1;
  updatedAt: string;
  tasks: CompensationTask[];
};

type UploadResult = {
  ok: boolean;
  messageId?: number;
  link?: string;
  bytes?: number;
  error?: string;
};

const DEFAULT_MODS_TABLE = path.join(dbModsRoot, "mods_table.json");
const DEFAULT_STATE_FILE = path.join(dbModsRoot, "tg_upload_state.json");
const DEFAULT_COMPENSATION_FILE = path.join(dbModsRoot, "tg_upload_compensation.json");
const DEFAULT_SESSION_FILE = path.join(dbImageRoot, "koikatu_session.session");
const PY_UPLOADER = path.join(siteRoot, "scripts", "telegram-upload-mod-one.py");

function parseArg(name: string) {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) {
    return direct.slice(name.length + 3);
  }
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0) {
    return process.argv[idx + 1];
  }
  const envKey = `npm_config_${name.replace(/-/g, "_")}`;
  if (typeof process.env[envKey] === "string" && process.env[envKey]) {
    return process.env[envKey];
  }
  return undefined;
}

function hasFlag(name: string) {
  if (process.argv.includes(`--${name}`)) {
    return true;
  }
  const envKey = `npm_config_${name.replace(/-/g, "_")}`;
  const value = process.env[envKey];
  if (typeof value !== "string") {
    return false;
  }
  if (value === "" || value === "true" || value === "1") {
    return true;
  }
  return false;
}

function modKey(row: Pick<ModTableRow, "Guid" | "Version" | "Filename">) {
  return `${row.Guid}||${row.Version || ""}||${row.Filename}`;
}

function normalizeMessageLink(row: ModTableRow) {
  if (typeof row.MessageLink === "string" && row.MessageLink.trim()) {
    return row.MessageLink.trim();
  }
  if (typeof row.messageLink === "string" && row.messageLink.trim()) {
    return row.messageLink.trim();
  }
  return "";
}

async function readJsonWithBom<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(filePath: string, value: unknown) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(tmp, filePath);
}

function formatBps(bps: number) {
  if (!Number.isFinite(bps) || bps <= 0) {
    return "0 B/s";
  }
  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  let value = bps;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[idx]}`;
}

function formatDurationMs(ms: number) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

function safeStdoutWrite(text: string) {
  try {
    if (process.stdout.writable) {
      process.stdout.write(text);
    }
  } catch {
    // Ignore broken pipe from interrupted parent process/log stream.
  }
}

process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error?.code === "EPIPE") {
    return;
  }
  console.error("[stdout-error]", error.message);
});

async function upsertModLibraryEntry(row: ModTableRow, messageLink: string) {
  const where = {
    guid: row.Guid,
    version: row.Version || "",
    filename: row.Filename
  };

  const existing = await db.modLibraryEntry.findFirst({
    where,
    select: { id: true }
  });

  if (existing) {
    await db.modLibraryEntry.update({
      where: { id: existing.id },
      data: {
        name: row.Name,
        version: row.Version || "",
        author: row.Author || "",
        guid: row.Guid,
        filename: row.Filename,
        messageLink
      }
    });
    return existing.id;
  }

  const created = await db.modLibraryEntry.create({
    data: {
      name: row.Name,
      version: row.Version || "",
      author: row.Author || "",
      guid: row.Guid,
      filename: row.Filename,
      messageLink
    },
    select: { id: true }
  });
  return created.id;
}

function enqueueCompensation(
  queue: CompensationQueue,
  task: Omit<CompensationTask, "id" | "createdAt">
) {
  const dedupeKey = `${task.stage}:${task.key}:${task.messageLink}`;
  const exists = queue.tasks.some((item) => `${item.stage}:${item.key}:${item.messageLink}` === dedupeKey);
  if (exists) {
    return;
  }
  queue.tasks.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
    ...task
  });
}

function parseUploaderEvent(line: string): { type?: string; [k: string]: unknown } | null {
  try {
    return JSON.parse(line) as { type?: string; [k: string]: unknown };
  } catch {
    return null;
  }
}

async function uploadOneWithProgress(params: {
  channel: string;
  filePath: string;
  sessionFile?: string;
  progressPrefix: string;
  partSizeKb?: number;
  progressIntervalMs?: number;
}): Promise<UploadResult> {
  return new Promise((resolve) => {
    const args = [PY_UPLOADER, "--channel", params.channel, "--file", params.filePath];
    if (params.sessionFile) {
      args.push("--session-file", params.sessionFile);
    }
    if (Number.isFinite(params.partSizeKb) && (params.partSizeKb || 0) > 0) {
      args.push("--part-size-kb", String(Math.trunc(params.partSizeKb || 0)));
    }
    if (Number.isFinite(params.progressIntervalMs) && (params.progressIntervalMs || 0) > 0) {
      args.push("--progress-interval-ms", String(Math.trunc(params.progressIntervalMs || 0)));
    }

    const child = spawn("python", args, {
      cwd: siteRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let done = false;
    let lastSent = 0;
    let lastTotal = 0;
    let lastAvg = 0;
    let result: UploadResult = { ok: false, error: "Unknown upload error" };

    const onFinish = (value: UploadResult) => {
      if (done) {
        return;
      }
      done = true;
      resolve(value);
    };

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      const lines = chunk.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        const event = parseUploaderEvent(line);
        if (!event || typeof event.type !== "string") {
          continue;
        }
        if (event.type === "progress") {
          const sent = Number(event.sent || 0);
          const total = Number(event.total || 0);
          const percent = Number(event.percent || 0);
          const avgBps = Number(event.avgBps || 0);
          lastSent = sent;
          lastTotal = total;
          lastAvg = avgBps;
          safeStdoutWrite(
            `\r${params.progressPrefix} ${percent.toFixed(1)}% (${sent}/${total}) @ ${formatBps(avgBps)}     `
          );
        } else if (event.type === "result") {
          const link = typeof event.link === "string" ? event.link : "";
          const messageId = Number(event.messageId || 0);
          result = {
            ok: Boolean(event.ok) && Boolean(link),
            link,
            messageId: Number.isFinite(messageId) && messageId > 0 ? messageId : undefined,
            bytes: lastTotal || lastSent
          };
        } else if (event.type === "error") {
          const error = typeof event.error === "string" ? event.error : "Upload failed";
          result = { ok: false, error };
        }
      }
    });

    let stderrBuffer = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderrBuffer += chunk;
    });

    child.on("error", (error) => {
      onFinish({ ok: false, error: error.message });
    });

    child.on("close", (code) => {
      safeStdoutWrite("\n");
      if (result.ok) {
        onFinish(result);
        return;
      }
      const errorMessage =
        result.error ||
        stderrBuffer.trim() ||
        `Uploader exited with code ${code ?? "unknown"} at avg ${formatBps(lastAvg)}`;
      onFinish({ ok: false, error: errorMessage });
    });
  });
}

async function replayCompensationTasks(params: {
  tasks: CompensationQueue;
  rows: ModTableRow[];
  tablePath: string;
  noDb: boolean;
}) {
  const remaining: CompensationTask[] = [];
  let resolved = 0;

  for (const task of params.tasks.tasks) {
    try {
      if (task.stage === "mods_table_write_failed") {
        const row = params.rows.find((item) => modKey(item) === task.key);
        if (!row) {
          continue;
        }
        row.MessageLink = task.messageLink;
        delete row.messageLink;
        await writeJsonAtomic(params.tablePath, params.rows);
        resolved += 1;
        continue;
      }

      if (task.stage === "db_upsert_failed") {
        if (params.noDb) {
          remaining.push(task);
          continue;
        }
        await upsertModLibraryEntry(
          {
            Name: task.name,
            Version: task.version,
            Author: task.author,
            Guid: task.guid,
            Filename: task.filename,
            Location: task.location,
            MessageLink: task.messageLink
          },
          task.messageLink
        );
        resolved += 1;
        continue;
      }

      remaining.push(task);
    } catch (error) {
      remaining.push({
        ...task,
        createdAt: task.createdAt,
        error: error instanceof Error ? error.message : task.error
      });
    }
  }

  params.tasks.tasks = remaining;
  params.tasks.updatedAt = new Date().toISOString();
  return { resolved, remaining: remaining.length };
}

async function main() {
  const channel = parseArg("channel") || process.env.TG_MOD_LIBRARY_CHANNEL || "https://t.me/KK_archive_modlibrary";
  const tablePath = parseArg("table") || DEFAULT_MODS_TABLE;
  const statePath = parseArg("state") || DEFAULT_STATE_FILE;
  const compensationPath = parseArg("compensation") || DEFAULT_COMPENSATION_FILE;
  const explicitSessionFile = parseArg("session-file");
  const sessionFile = explicitSessionFile || (existsSync(DEFAULT_SESSION_FILE) ? DEFAULT_SESSION_FILE : undefined);
  const rawLimitArg = parseArg("limit");
  const hasLimitArg = typeof rawLimitArg === "string";
  const parsedLimit = hasLimitArg ? Number(rawLimitArg) : NaN;
  const limit = Number.isFinite(parsedLimit) ? Math.max(0, Math.trunc(parsedLimit)) : 0;
  const dryRun = hasFlag("dry-run");
  const skipFailed = hasFlag("skip-failed");
  const onlyMissingLink = !hasFlag("include-linked");
  const noDb = hasFlag("no-db");
  const compensationOnly = hasFlag("compensation-only");
  const partSizeKb = Number(parseArg("part-size-kb") || process.env.TG_UPLOAD_PART_SIZE_KB || "512");
  const progressIntervalMs = Number(
    parseArg("progress-interval-ms") || process.env.TG_UPLOAD_PROGRESS_INTERVAL_MS || "200"
  );

  const rows = await readJsonWithBom<ModTableRow[]>(tablePath, []);
  if (!Array.isArray(rows)) {
    throw new Error(`Invalid mods table format: ${tablePath}`);
  }

  const state = await readJsonWithBom<UploadState>(statePath, {
    version: 1,
    channel,
    updatedAt: new Date(0).toISOString(),
    entries: {}
  });

  const compensation = await readJsonWithBom<CompensationQueue>(compensationPath, {
    version: 1,
    updatedAt: new Date(0).toISOString(),
    tasks: []
  });

  let processed = 0;
  let uploaded = 0;
  let synced = 0;
  let skipped = 0;
  let failed = 0;
  let totalBytes = 0;
  const startedAt = Date.now();

  const replay = await replayCompensationTasks({
    tasks: compensation,
    rows,
    tablePath,
    noDb
  });
  if (replay.resolved > 0 || replay.remaining > 0) {
    console.log(
      `[compensation] resolved=${replay.resolved} remaining=${replay.remaining} noDb=${noDb ? "true" : "false"}`
    );
  }

  const candidates = rows.filter((row) => {
    if (!row || typeof row !== "object") {
      return false;
    }
    if (typeof row.Guid !== "string" || typeof row.Filename !== "string") {
      return false;
    }
    const link = normalizeMessageLink(row);
    if (onlyMissingLink && link) {
      return false;
    }
    return true;
  });

  const queue = compensationOnly ? [] : hasLimitArg ? candidates.slice(0, limit) : candidates;
  console.log(`[mod-sync] channel=${channel}`);
  console.log(
    `[mod-sync] candidates=${queue.length} (from ${rows.length}) dryRun=${dryRun} noDb=${noDb} compensationOnly=${compensationOnly} partSizeKb=${partSizeKb} progressIntervalMs=${progressIntervalMs}`
  );

  for (let i = 0; i < queue.length; i += 1) {
    const row = queue[i]!;
    const key = modKey(row);
    const stateEntry = state.entries[key];
    const existingLink = normalizeMessageLink(row);
    const nowIso = new Date().toISOString();
    const prefix = `[${i + 1}/${queue.length}] ${row.Filename}`;

    if (skipFailed && stateEntry?.status === "failed" && !existingLink) {
      skipped += 1;
      console.log(`${prefix} skipped (previously failed; --skip-failed enabled)`);
      continue;
    }

    if (dryRun) {
      processed += 1;
      console.log(`${prefix} dry-run`);
      continue;
    }

    let messageLink = existingLink;
    let messageId: number | undefined;
    let uploadedBytes = 0;

    if (!messageLink) {
      const filePath = (row.Location || "").trim();
      if (!filePath) {
        failed += 1;
        state.entries[key] = {
          key,
          status: "failed",
          attempts: (stateEntry?.attempts || 0) + 1,
          lastAttemptAt: nowIso,
          lastError: "Location is empty in mods_table"
        };
        console.error(`${prefix} failed: Location is empty`);
        continue;
      }

      try {
        await fs.access(filePath);
      } catch {
        failed += 1;
        state.entries[key] = {
          key,
          status: "failed",
          attempts: (stateEntry?.attempts || 0) + 1,
          lastAttemptAt: nowIso,
          lastError: `File not found: ${filePath}`
        };
        console.error(`${prefix} failed: file missing -> ${filePath}`);
        continue;
      }

      const uploadResult = await uploadOneWithProgress({
        channel,
        filePath,
        sessionFile,
        progressPrefix: prefix,
        partSizeKb,
        progressIntervalMs
      });

      if (!uploadResult.ok || !uploadResult.link) {
        failed += 1;
        state.entries[key] = {
          key,
          status: "failed",
          attempts: (stateEntry?.attempts || 0) + 1,
          lastAttemptAt: nowIso,
          lastError: uploadResult.error || "Upload failed"
        };
        console.error(`${prefix} failed: ${uploadResult.error || "Upload failed"}`);
        continue;
      }

      messageLink = uploadResult.link;
      messageId = uploadResult.messageId;
      uploadedBytes = uploadResult.bytes || 0;
      totalBytes += uploadedBytes;
      uploaded += 1;

      row.MessageLink = messageLink;
      delete row.messageLink;

      try {
        await writeJsonAtomic(tablePath, rows);
      } catch (error) {
        const err = error instanceof Error ? error.message : "Failed to write mods_table";
        enqueueCompensation(compensation, {
          stage: "mods_table_write_failed",
          key,
          name: row.Name,
          version: row.Version,
          author: row.Author,
          guid: row.Guid,
          filename: row.Filename,
          location: row.Location,
          messageLink,
          messageId,
          error: err
        });
      }

      state.entries[key] = {
        key,
        status: "success",
        attempts: (stateEntry?.attempts || 0) + 1,
        lastAttemptAt: nowIso,
        messageId,
        messageLink,
        bytes: uploadedBytes
      };

      console.log(`${prefix} uploaded -> ${messageLink}`);
    }

    if (!noDb && messageLink) {
      try {
        await upsertModLibraryEntry(row, messageLink);
        synced += 1;
      } catch (error) {
        failed += 1;
        const err = error instanceof Error ? error.message : "DB upsert failed";
        enqueueCompensation(compensation, {
          stage: "db_upsert_failed",
          key,
          name: row.Name,
          version: row.Version,
          author: row.Author,
          guid: row.Guid,
          filename: row.Filename,
          location: row.Location,
          messageLink,
          messageId,
          error: err
        });
        state.entries[key] = {
          key,
          status: "failed",
          attempts: (stateEntry?.attempts || 0) + 1,
          lastAttemptAt: nowIso,
          lastError: err,
          messageId,
          messageLink
        };
        console.error(`${prefix} db failed: ${err}`);
        continue;
      }
    }

    processed += 1;
    const elapsed = Math.max(1, Date.now() - startedAt);
    const filesPerMinute = (processed * 60_000) / elapsed;
    const avgUploadSpeed = totalBytes > 0 ? (totalBytes * 1000) / elapsed : 0;
    console.log(
      `[progress] ${processed}/${queue.length} | uploaded=${uploaded} synced=${synced} failed=${failed} skipped=${skipped} | ${filesPerMinute.toFixed(
        2
      )} files/min | avg ${formatBps(avgUploadSpeed)}`
    );
  }

  state.channel = channel;
  state.updatedAt = new Date().toISOString();
  compensation.updatedAt = new Date().toISOString();

  await Promise.all([writeJsonAtomic(statePath, state), writeJsonAtomic(compensationPath, compensation)]);

  const totalElapsed = Date.now() - startedAt;
  console.log("------------------------------------------------------------");
  console.log(`[done] processed=${processed} uploaded=${uploaded} synced=${synced} failed=${failed} skipped=${skipped}`);
  console.log(`[done] elapsed=${formatDurationMs(totalElapsed)} avg=${formatBps(totalBytes > 0 ? (totalBytes * 1000) / Math.max(1, totalElapsed) : 0)}`);
  console.log(`[done] state=${statePath}`);
  console.log(`[done] compensation=${compensationPath} (tasks=${compensation.tasks.length})`);
  console.log("------------------------------------------------------------");
}

main()
  .catch(async (error) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      console.error("[fatal] Mod library table missing. Run db push/migrate on Supabase first.");
    } else {
      console.error("[fatal]", error);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect().catch(() => undefined);
  });
