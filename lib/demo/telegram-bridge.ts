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

function getBridgeEnv() {
  return {
    ...process.env,
    PYTHONIOENCODING: "utf-8"
  };
}

export async function inspectTelegramSource(url: string): Promise<TelegramInspectSourceResult> {
  const child = spawn(/* turbopackIgnore: true */ PYTHON_COMMAND, [BRIDGE_SCRIPT_PATH, "inspect-source", "--url", url], {
    cwd: process.cwd(),
    env: getBridgeEnv(),
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
    child.once("error", reject);
    child.once("close", resolve);
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
  const child = spawn(
    /* turbopackIgnore: true */ PYTHON_COMMAND,
    [BRIDGE_SCRIPT_PATH, "stream-media", "--url", params.url, "--message-id", String(params.messageId)],
    {
      cwd: process.cwd(),
      env: getBridgeEnv(),
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  let stderrText = "";
  child.stderr.on("data", (chunk: Buffer) => {
    stderrText += chunk.toString("utf8");
  });

  const exitPromise = new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (exitCode) => {
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
