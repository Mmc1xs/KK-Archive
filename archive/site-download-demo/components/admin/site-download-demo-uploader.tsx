"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type SiteDownloadDemoCandidate = {
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

type SiteDownloadDemoResolvedLink = {
  label: string;
  targetUrl: string;
  targetMessageId: number;
  groupedId: number | null;
  candidateCount: number;
  candidates: SiteDownloadDemoCandidate[];
};

type UploadProgress = {
  phase: "uploading" | "finalizing";
  currentFileName: string;
  currentFileIndex: number;
  totalFiles: number;
  completedFiles: number;
  parallelUploads: number;
  fileUploadedBytes: number;
  fileTelegramDownloadedBytes: number;
  fileTotalBytes: number;
  totalTelegramDownloadedBytes: number;
  totalUploadedBytes: number;
  totalBytes: number;
  elapsedMs: number;
  totalTelegramSpeedBytesPerSecond: number;
  totalUploadSpeedBytesPerSecond: number;
  activeFiles: Array<{
    fileName: string;
    fileIndex: number;
    telegramDownloadedBytes: number;
    uploadedBytes: number;
    totalBytes: number;
    telegramSpeedBytesPerSecond: number;
    speedBytesPerSecond: number;
  }>;
};

type BackgroundUploadStatus = {
  contentId: number;
  stage: "queued" | "uploading" | "finalizing" | "completed" | "failed";
  progress: UploadProgress | null;
  errorMessage: string | null;
  totalFiles: number;
  updatedAt: string;
  createdAt: string;
};

type SiteDownloadDemoUploaderProps = {
  contentId: number;
  resolvedLinks: SiteDownloadDemoResolvedLink[];
};

function formatBytes(byteSize: number) {
  if (byteSize >= 1024 * 1024 * 1024) {
    return `${(byteSize / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  if (byteSize >= 1024 * 1024) {
    return `${(byteSize / 1024 / 1024).toFixed(1)} MB`;
  }

  if (byteSize >= 1024) {
    return `${(byteSize / 1024).toFixed(1)} KB`;
  }

  return `${byteSize} B`;
}

function formatSpeed(bytesPerSecond: number) {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) {
    return "0 B/s";
  }

  return `${formatBytes(bytesPerSecond)}/s`;
}

function getCandidateKey(candidate: SiteDownloadDemoCandidate) {
  return `${candidate.targetUrl}:${candidate.messageId}:${candidate.fileName}:${candidate.kind}`;
}

function buildTelegramAppHref(url: string) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);

    if (parsed.hostname !== "t.me" && parsed.hostname !== "telegram.me" && !parsed.hostname.endsWith(".t.me")) {
      return url;
    }

    if (parts[0] === "c" && parts.length >= 3) {
      return `tg://privatepost?channel=${parts[1]}&post=${parts[2]}`;
    }

    if (parts.length >= 2) {
      return `tg://resolve?domain=${parts[0]}&post=${parts[1]}`;
    }

    if (parts.length === 1) {
      return `tg://resolve?domain=${parts[0]}`;
    }

    return url;
  } catch {
    return url;
  }
}

function isTerminalStage(stage: BackgroundUploadStatus["stage"]) {
  return stage === "completed" || stage === "failed";
}

function getStageLabel(stage: BackgroundUploadStatus["stage"]) {
  switch (stage) {
    case "queued":
      return "Queued";
    case "uploading":
      return "Uploading";
    case "finalizing":
      return "Finalizing";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return stage;
  }
}

export function SiteDownloadDemoUploader({
  contentId,
  resolvedLinks
}: SiteDownloadDemoUploaderProps) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [isQueueing, setIsQueueing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<BackgroundUploadStatus | null>(null);
  const previousStageRef = useRef<BackgroundUploadStatus["stage"] | null>(null);

  const allCandidates = useMemo(
    () => resolvedLinks.flatMap((link) => link.candidates),
    [resolvedLinks]
  );
  const selectedCandidates = useMemo(() => {
    const selectedKeySet = new Set(selectedKeys);
    return allCandidates.filter((candidate) => selectedKeySet.has(getCandidateKey(candidate)));
  }, [allCandidates, selectedKeys]);
  const shouldPollStatus = status ? !isTerminalStage(status.stage) : false;

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function refreshStatus() {
      try {
        const response = await fetch(`/api/admin/site-download-demo/${contentId}/upload`, {
          cache: "no-store"
        });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { status: BackgroundUploadStatus | null };
        if (!cancelled) {
          setStatus(payload.status ?? null);
        }
      } catch {
        // Keep the last known status.
      }
    }

    void refreshStatus();

    if (shouldPollStatus) {
      intervalId = setInterval(() => {
        void refreshStatus();
      }, 1500);
    }

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [contentId, shouldPollStatus]);

  useEffect(() => {
    const previousStage = previousStageRef.current;
    previousStageRef.current = status?.stage ?? null;

    if (!status || status.stage === previousStage) {
      return;
    }

    if (status.stage === "completed") {
      setError("");
      setMessage("Background upload completed. Hosted Files are ready for review.");
      startRefresh(() => {
        router.refresh();
      });
      return;
    }

    if (status.stage === "failed" && status.errorMessage) {
      setError(status.errorMessage);
    }
  }, [router, startRefresh, status]);

  function toggleCandidate(candidate: SiteDownloadDemoCandidate) {
    const key = getCandidateKey(candidate);
    setSelectedKeys((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  async function handleQueueUpload() {
    if (!selectedCandidates.length || isQueueing) {
      return;
    }

    setIsQueueing(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/admin/site-download-demo/${contentId}/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          selectedFiles: selectedCandidates
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Failed to queue upload");
      }

      const payload = (await response.json()) as {
        queued: boolean;
        status: BackgroundUploadStatus;
      };
      setStatus(payload.status);
      setMessage("Queued in the background. You can move on to the next content while this upload continues.");
    } catch (queueError) {
      setError(queueError instanceof Error ? queueError.message : "Failed to queue upload");
    } finally {
      setIsQueueing(false);
    }
  }

  const progress = status?.progress ?? null;
  const fileProgressPercent = useMemo(() => {
    if (!progress || progress.fileTotalBytes <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round((progress.fileUploadedBytes / progress.fileTotalBytes) * 100)));
  }, [progress]);
  const totalProgressPercent = useMemo(() => {
    if (!progress || progress.totalBytes <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round((progress.totalUploadedBytes / progress.totalBytes) * 100)));
  }, [progress]);

  return (
    <div className="grid">
      {resolvedLinks.map((link) => (
        <article key={`${link.targetUrl}-${link.targetMessageId}`} className="site-download-target-card">
          <div className="split">
            <div>
              <div className="eyebrow">{link.label}</div>
              <strong>{link.targetUrl}</strong>
              <div className="muted">
                Target message {link.targetMessageId}
                {link.groupedId ? ` - Album ${link.groupedId}` : " - Single file"}
              </div>
            </div>
            <div className="inline-actions">
              <a href={buildTelegramAppHref(link.targetUrl)} className="link-pill">
                Open in TG App
              </a>
              <a href={link.targetUrl} target="_blank" rel="noreferrer" className="link-pill">
                Open in Browser
              </a>
            </div>
          </div>

          <div className="site-download-candidate-grid">
            {link.candidates.map((candidate) => {
              const candidateKey = getCandidateKey(candidate);
              const checked = selectedKeys.includes(candidateKey);

              return (
                <label
                  key={candidateKey}
                  className={checked ? "site-download-candidate-card site-download-candidate-card-selected" : "site-download-candidate-card"}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isQueueing || shouldPollStatus}
                    onChange={() => toggleCandidate(candidate)}
                  />
                  <div className="site-download-candidate-copy">
                    <strong>{candidate.fileName}</strong>
                    <small>{candidate.mimeType}</small>
                    <small>{formatBytes(candidate.byteSize)}</small>
                    <small>{`Message ${candidate.messageId}${candidate.groupedId ? ` - Album ${candidate.groupedId}` : ""}`}</small>
                    {candidate.caption ? <small>{candidate.caption}</small> : null}
                  </div>
                </label>
              );
            })}
          </div>
        </article>
      ))}

      {status ? (
        <div className="hosted-upload-progress">
          <div className="split">
            <strong>{`Background Upload - ${getStageLabel(status.stage)}`}</strong>
            <span>{progress ? `${totalProgressPercent}%` : `${status.totalFiles} file(s)`}</span>
          </div>
          {progress ? (
            <>
              <small>
                {progress.phase === "uploading"
                  ? `${progress.completedFiles} / ${progress.totalFiles} uploaded to R2 - TG ${formatSpeed(progress.totalTelegramSpeedBytesPerSecond)} - R2 ${formatSpeed(progress.totalUploadSpeedBytesPerSecond)}`
                  : `Linking Hosted Files - ${progress.currentFileIndex} / ${progress.totalFiles}`}
              </small>
              <div className="hosted-upload-progress-bar">
                <span style={{ width: `${fileProgressPercent}%` }} />
              </div>
              <small>
                TG: {formatBytes(progress.totalTelegramDownloadedBytes)} / {formatBytes(progress.totalBytes)} | R2:{" "}
                {formatBytes(progress.totalUploadedBytes)} / {formatBytes(progress.totalBytes)}
              </small>
              <div className="hosted-upload-progress-bar hosted-upload-progress-bar-total">
                <span style={{ width: `${totalProgressPercent}%` }} />
              </div>
            </>
          ) : (
            <small>
              {status.stage === "queued"
                ? "Queued in the background. You can move to the next content now."
                : status.stage === "completed"
                  ? "Upload finished."
                  : status.stage === "failed"
                    ? status.errorMessage || "Upload failed."
                    : "Preparing upload status..."}
            </small>
          )}
          {progress?.phase === "uploading" ? (
            <div className="site-download-progress-file-list">
              {progress.activeFiles.map((file) => {
                const filePercent =
                  file.totalBytes > 0 ? Math.max(0, Math.min(100, Math.round((file.uploadedBytes / file.totalBytes) * 100))) : 0;

                return (
                  <div key={`${file.fileIndex}:${file.fileName}`} className="site-download-progress-file">
                    <div className="split">
                      <strong>{`${file.fileIndex}. ${file.fileName}`}</strong>
                      <span>{`TG ${formatSpeed(file.telegramSpeedBytesPerSecond)} | R2 ${formatSpeed(file.speedBytesPerSecond)}`}</span>
                    </div>
                    <small>
                      TG: {formatBytes(file.telegramDownloadedBytes)} / {formatBytes(file.totalBytes)} | R2:{" "}
                      {formatBytes(file.uploadedBytes)} / {formatBytes(file.totalBytes)}
                    </small>
                    <div className="hosted-upload-progress-bar">
                      <span style={{ width: `${filePercent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
          {status.errorMessage ? <small>{status.errorMessage}</small> : null}
        </div>
      ) : null}

      {message ? <div className="notice success">{message}</div> : null}
      {error ? <div className="notice error">{error}</div> : null}

      <div className="split">
        <div className="muted">
          {selectedCandidates.length
            ? `${selectedCandidates.length} file(s) selected`
            : "Select one or more TG files to queue for background upload into R2."}
        </div>
        <button type="button" disabled={!selectedCandidates.length || isQueueing || isRefreshing || shouldPollStatus} onClick={handleQueueUpload}>
          {isQueueing ? "Queueing..." : isRefreshing ? "Refreshing..." : shouldPollStatus ? "Background Upload Running..." : "Queue Selected to R2"}
        </button>
      </div>
    </div>
  );
}
