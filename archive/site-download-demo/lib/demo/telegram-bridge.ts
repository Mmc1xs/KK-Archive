import fs from "fs";
import os from "os";
import { spawn } from "child_process";
import path from "path";

export type TelegramMediaCandidate = {
  targetUrl: string;
  linkLabel: string;
  messageId: number;
  groupedId: number | null;
  fileName: string;
  mimeType: string;
  byteSize: number;
  caption: string;
  kind: "photo" | "document";
};

export type TelegramResolvedLink = {
  label: string;
  targetUrl: string;
  targetMessageId: number;
  groupedId: number | null;
  candidateCount: number;
  candidates: TelegramMediaCandidate[];
};

export type TelegramInspectSourceResult = {
  sourceUrl: string;
  sourceMessageId: number;
  sourceGroupedId: number | null;
  sourceChatId: number | null;
  resolvedLinks: TelegramResolvedLink[];
};

const PYTHON_COMMAND = process.env.PYTHON_COMMAND || "python";
const BRIDGE_SCRIPT_PATH = path.join(/* turbopackIgnore: true */ process.cwd(), "scripts", "telegram_demo_bridge.py");
const TEMP_SESSION_PREFIX = "kkd-telegram-session-";

function resolveConfiguredSessionFilePath() {
  const rawSessionName = process.env.TG_SESSION?.trim() || "koikatu_session";
  const sessionPath = path.isAbsolute(rawSessionName)
    ? rawSessionName
    : path.join(/* turbopackIgnore: true */ process.cwd(), "db image", rawSessionName);

  return sessionPath.toLowerCase().endsWith(".session") ? sessionPath : `${sessionPath}.session`;
}

function createIsolatedBridgeSession() {
  const sourceSessionFilePath = resolveConfiguredSessionFilePath();
  if (!fs.existsSync(sourceSessionFilePath)) {
    throw new Error(`Telegram session file not found: ${sourceSessionFilePath}`);
  }

  const tempDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), TEMP_SESSION_PREFIX));
  const tempSessionFilePath = path.join(tempDirectoryPath, path.basename(sourceSessionFilePath));
  fs.copyFileSync(sourceSessionFilePath, tempSessionFilePath);

  for (const suffix of ["-wal", "-shm", "-journal"]) {
    const sidecarPath = `${sourceSessionFilePath}${suffix}`;
    if (fs.existsSync(sidecarPath)) {
      fs.copyFileSync(sidecarPath, `${tempSessionFilePath}${suffix}`);
    }
  }

  let cleanedUp = false;
  return {
    sessionFilePath: tempSessionFilePath,
    cleanup() {
      if (cleanedUp) {
        return;
      }

      cleanedUp = true;
      fs.rmSync(tempDirectoryPath, { recursive: true, force: true });
    }
  };
}

function getBridgeEnv(sessionOverridePath?: string) {
  return {
    ...process.env,
    PYTHONIOENCODING: "utf-8",
    ...(sessionOverridePath
      ? {
          TG_SESSION_OVERRIDE_PATH: sessionOverridePath
        }
      : {})
  };
}

export async function inspectTelegramSource(url: string): Promise<TelegramInspectSourceResult> {
  const isolatedSession = createIsolatedBridgeSession();
  const child = spawn(/* turbopackIgnore: true */ PYTHON_COMMAND, [BRIDGE_SCRIPT_PATH, "inspect-source", "--url", url], {
    cwd: process.cwd(),
    env: getBridgeEnv(isolatedSession.sessionFilePath),
    stdio: ["ignore", "pipe", "pipe"]
  });

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];

  child.stdout.on("data", (chunk: Buffer) => {
    stdoutChunks.push(chunk);
  });

  child.stderr.on("data", (chunk: Buffer) => {
    stderrChunks.push(chunk);
  });

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", (error) => {
      isolatedSession.cleanup();
      reject(error);
    });
    child.once("close", (code) => {
      isolatedSession.cleanup();
      resolve(code ?? 1);
    });
  });

  const stderrText = Buffer.concat(stderrChunks).toString("utf8").trim();
  if (exitCode !== 0) {
    throw new Error(stderrText || "Failed to inspect Telegram source message");
  }

  const stdoutText = Buffer.concat(stdoutChunks).toString("utf8").trim();
  if (!stdoutText) {
    throw new Error("Telegram bridge returned an empty inspection result");
  }

  return JSON.parse(stdoutText) as TelegramInspectSourceResult;
}

export function spawnTelegramMediaStream(params: { url: string; messageId: number }) {
  const isolatedSession = createIsolatedBridgeSession();
  const child = spawn(
    /* turbopackIgnore: true */ PYTHON_COMMAND,
    [BRIDGE_SCRIPT_PATH, "stream-media", "--url", params.url, "--message-id", String(params.messageId)],
    {
      cwd: process.cwd(),
      env: getBridgeEnv(isolatedSession.sessionFilePath),
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  let stderrText = "";
  child.stderr.on("data", (chunk: Buffer) => {
    stderrText += chunk.toString("utf8");
  });

  const exitPromise = new Promise<void>((resolve, reject) => {
    child.once("error", (error) => {
      isolatedSession.cleanup();
      reject(error);
    });
    child.once("close", (exitCode) => {
      isolatedSession.cleanup();
      if (exitCode !== 0) {
        reject(new Error(stderrText.trim() || `Telegram bridge exited with code ${exitCode}`));
        return;
      }

      resolve();
    });
  });

  return {
    stream: child.stdout,
    kill() {
      child.kill();
    },
    async wait() {
      await exitPromise;
    }
  };
}
