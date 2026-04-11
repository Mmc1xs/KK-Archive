import fs from "fs";
import path from "path";
import { type TelegramMediaCandidate } from "@/lib/demo/telegram-bridge";
import { uploadSiteDownloadDemoSelections, type SiteDownloadDemoUploadProgress } from "@/lib/demo/site-download";

type BackgroundUploadStage = "queued" | "uploading" | "finalizing" | "completed" | "failed";

type BackgroundUploadJob = {
  contentId: number;
  actorUserId: number;
  telegramSourceUrl: string;
  selections: TelegramMediaCandidate[];
  stage: BackgroundUploadStage;
  progress: SiteDownloadDemoUploadProgress | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SiteDownloadDemoBackgroundUploadStatus = {
  contentId: number;
  stage: BackgroundUploadStage;
  progress: SiteDownloadDemoUploadProgress | null;
  errorMessage: string | null;
  totalFiles: number;
  updatedAt: string;
  createdAt: string;
};

type BackgroundUploadManager = {
  jobsByContentId: Map<number, BackgroundUploadJob>;
  queue: number[];
  waitingResolvers: Array<() => void>;
  workersStarted: boolean;
};

declare global {
  var siteDownloadDemoBackgroundUploadQueueSingleton: BackgroundUploadManager | undefined;
}

const GLOBAL_UPLOAD_LOCK_DIR = path.join(process.cwd(), "temp", "site-download-demo-background");
const GLOBAL_UPLOAD_LOCK_FILE = path.join(GLOBAL_UPLOAD_LOCK_DIR, "global-upload.lock");
const GLOBAL_UPLOAD_LOCK_STALE_MS = 1000 * 60 * 60 * 6;

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function ensureGlobalUploadLockDir() {
  fs.mkdirSync(GLOBAL_UPLOAD_LOCK_DIR, { recursive: true });
}

function tryClearStaleGlobalUploadLock() {
  try {
    const stats = fs.statSync(GLOBAL_UPLOAD_LOCK_FILE);
    if (Date.now() - stats.mtimeMs <= GLOBAL_UPLOAD_LOCK_STALE_MS) {
      return;
    }

    fs.rmSync(GLOBAL_UPLOAD_LOCK_FILE, { force: true });
  } catch {
    // Ignore missing or transient stat/remove issues and retry on the next loop.
  }
}

async function acquireGlobalUploadLock(contentId: number) {
  ensureGlobalUploadLockDir();

  while (true) {
    tryClearStaleGlobalUploadLock();

    try {
      const handle = await fs.promises.open(GLOBAL_UPLOAD_LOCK_FILE, "wx");
      await handle.writeFile(
        JSON.stringify({
          contentId,
          pid: process.pid,
          acquiredAt: new Date().toISOString()
        })
      );
      await handle.close();

      let released = false;
      return {
        async release() {
          if (released) {
            return;
          }

          released = true;
          await fs.promises.rm(GLOBAL_UPLOAD_LOCK_FILE, { force: true }).catch(() => undefined);
        }
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code !== "EEXIST") {
        throw error;
      }
    }

    await sleep(400);
  }
}

function getManager() {
  if (!global.siteDownloadDemoBackgroundUploadQueueSingleton) {
    global.siteDownloadDemoBackgroundUploadQueueSingleton = {
      jobsByContentId: new Map(),
      queue: [],
      waitingResolvers: [],
      workersStarted: false
    };
  }

  return global.siteDownloadDemoBackgroundUploadQueueSingleton;
}

function touchJob(job: BackgroundUploadJob) {
  job.updatedAt = new Date();
}

function buildSnapshot(job: BackgroundUploadJob): SiteDownloadDemoBackgroundUploadStatus {
  return {
    contentId: job.contentId,
    stage: job.stage,
    progress: job.progress,
    errorMessage: job.errorMessage,
    totalFiles: job.selections.length,
    updatedAt: job.updatedAt.toISOString(),
    createdAt: job.createdAt.toISOString()
  };
}

function notifyQueue(waitingResolvers: Array<() => void>) {
  const resolver = waitingResolvers.shift();
  resolver?.();
}

async function takeQueuedContentId(manager: BackgroundUploadManager): Promise<number> {
  while (manager.queue.length === 0) {
    await new Promise<void>((resolve) => {
      manager.waitingResolvers.push(resolve);
    });
  }

  const contentId = manager.queue.shift();
  if (typeof contentId !== "number") {
    throw new Error("Queued upload item was unexpectedly missing");
  }

  return contentId;
}

async function runWorker(manager: BackgroundUploadManager) {
  while (true) {
    const contentId = await takeQueuedContentId(manager);
    const job = manager.jobsByContentId.get(contentId);
    if (!job || job.stage !== "queued") {
      continue;
    }

    const uploadLock = await acquireGlobalUploadLock(contentId);

    try {
      job.stage = "uploading";
      job.errorMessage = null;
      touchJob(job);

      await uploadSiteDownloadDemoSelections({
        contentId: job.contentId,
        actorUserId: job.actorUserId,
        telegramSourceUrl: job.telegramSourceUrl,
        selections: job.selections,
        onProgress(progress) {
          job.progress = progress;
          job.stage = progress.phase === "finalizing" ? "finalizing" : "uploading";
          touchJob(job);
        }
      });
      job.stage = "completed";
      touchJob(job);
    } catch (error) {
      const errorMessage = error instanceof Error ? `${error.name}: ${error.message}` : "Upload failed";
      console.error("[site-download-demo][background-upload] job failed", {
        contentId: job.contentId,
        telegramSourceUrl: job.telegramSourceUrl,
        fileCount: job.selections.length,
        error
      });
      job.stage = "failed";
      job.errorMessage = errorMessage;
      touchJob(job);
    } finally {
      await uploadLock.release();
    }
  }
}

function ensureWorkersStarted(manager: BackgroundUploadManager) {
  if (manager.workersStarted) {
    return;
  }

  manager.workersStarted = true;
  const maxWorkers = 1;
  for (let index = 0; index < maxWorkers; index += 1) {
    void runWorker(manager);
  }
}

export function getSiteDownloadDemoBackgroundUploadStatus(contentId: number) {
  const manager = getManager();
  ensureWorkersStarted(manager);
  const job = manager.jobsByContentId.get(contentId);
  return job ? buildSnapshot(job) : null;
}

export function listSiteDownloadDemoBackgroundUploadStatuses() {
  const manager = getManager();
  ensureWorkersStarted(manager);
  return new Map(
    [...manager.jobsByContentId.entries()].map(([contentId, job]) => [contentId, buildSnapshot(job)])
  );
}

export function enqueueSiteDownloadDemoBackgroundUpload(params: {
  contentId: number;
  actorUserId: number;
  telegramSourceUrl: string;
  selections: TelegramMediaCandidate[];
}) {
  const manager = getManager();
  ensureWorkersStarted(manager);

  const existingJob = manager.jobsByContentId.get(params.contentId);
  if (existingJob && (existingJob.stage === "queued" || existingJob.stage === "uploading" || existingJob.stage === "finalizing")) {
    return buildSnapshot(existingJob);
  }

  const job: BackgroundUploadJob = {
    contentId: params.contentId,
    actorUserId: params.actorUserId,
    telegramSourceUrl: params.telegramSourceUrl,
    selections: params.selections,
    stage: "queued",
    progress: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  manager.jobsByContentId.set(params.contentId, job);
  manager.queue.push(params.contentId);
  notifyQueue(manager.waitingResolvers);
  return buildSnapshot(job);
}
