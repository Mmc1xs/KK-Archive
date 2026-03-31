"use client";

import { useMemo, useState, useTransition } from "react";
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
  fileUploadedBytes: number;
  fileTotalBytes: number;
  totalUploadedBytes: number;
  totalBytes: number;
};

type UploadEvent =
  | { type: "started"; totalFiles: number }
  | { type: "progress"; progress: UploadProgress }
  | { type: "complete"; uploadedCount: number; hostedFileCount: number }
  | { type: "error"; error: string };

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

function getCandidateKey(candidate: SiteDownloadDemoCandidate) {
  return `${candidate.targetUrl}:${candidate.messageId}:${candidate.fileName}:${candidate.kind}`;
}

export function SiteDownloadDemoUploader({
  contentId,
  resolvedLinks
}: SiteDownloadDemoUploaderProps) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  const allCandidates = useMemo(
    () => resolvedLinks.flatMap((link) => link.candidates),
    [resolvedLinks]
  );
  const selectedCandidates = useMemo(() => {
    const selectedKeySet = new Set(selectedKeys);
    return allCandidates.filter((candidate) => selectedKeySet.has(getCandidateKey(candidate)));
  }, [allCandidates, selectedKeys]);

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

  function toggleCandidate(candidate: SiteDownloadDemoCandidate) {
    const key = getCandidateKey(candidate);
    setSelectedKeys((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  async function handleUpload() {
    if (!selectedCandidates.length || isUploading) {
      return;
    }

    setIsUploading(true);
    setMessage("");
    setError("");
    setProgress(null);

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
        throw new Error(payload?.error || "Upload failed");
      }

      if (!response.body) {
        throw new Error("Upload progress stream was not available");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            continue;
          }

          const event = JSON.parse(trimmed) as UploadEvent;
          if (event.type === "progress") {
            setProgress(event.progress);
            continue;
          }

          if (event.type === "complete") {
            setMessage(`Uploaded ${event.uploadedCount} file(s). Hosted Files are ready for review.`);
            startRefresh(() => {
              router.refresh();
            });
            continue;
          }

          if (event.type === "error") {
            throw new Error(event.error);
          }
        }
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

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
            <a href={link.targetUrl} target="_blank" rel="noreferrer" className="link-pill">
              Open Telegram
            </a>
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
                    disabled={isUploading}
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

      {progress ? (
        <div className="hosted-upload-progress">
          <div className="split">
            <strong>{progress.currentFileName}</strong>
            <span>{totalProgressPercent}%</span>
          </div>
          <small>
            File {progress.currentFileIndex} / {progress.totalFiles}
            {progress.phase === "finalizing" ? " - Finalizing Hosted Files" : " - Uploading to R2"}
          </small>
          <small>
            Current file: {formatBytes(progress.fileUploadedBytes)} / {formatBytes(progress.fileTotalBytes)}
          </small>
          <div className="hosted-upload-progress-bar">
            <span style={{ width: `${fileProgressPercent}%` }} />
          </div>
          <small>
            Total: {formatBytes(progress.totalUploadedBytes)} / {formatBytes(progress.totalBytes)}
          </small>
          <div className="hosted-upload-progress-bar hosted-upload-progress-bar-total">
            <span style={{ width: `${totalProgressPercent}%` }} />
          </div>
        </div>
      ) : null}

      {message ? <div className="notice success">{message}</div> : null}
      {error ? <div className="notice error">{error}</div> : null}

      <div className="split">
        <div className="muted">
          {selectedCandidates.length
            ? `${selectedCandidates.length} file(s) selected`
            : "Select one or more Telegram files to upload directly into R2."}
        </div>
        <button type="button" disabled={!selectedCandidates.length || isUploading || isRefreshing} onClick={handleUpload}>
          {isUploading ? "Uploading..." : isRefreshing ? "Refreshing..." : "Upload Selected to R2"}
        </button>
      </div>
    </div>
  );
}
