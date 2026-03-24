"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { UserRole } from "@prisma/client";

type HostedFileRecord = {
  id: number;
  fileName: string;
  objectKey: string;
  mimeType: string;
  byteSize: number;
  createdAt: Date | string;
  uploadedBy: {
    id: number;
    username: string | null;
    email: string;
    role: UserRole;
  };
};

type UploadInitResponse = {
  upload: {
    id: number;
    uploadMethod: "SINGLE" | "MULTIPART";
  };
  directUploadUrl: string | null;
  storageFolder: string;
  limits: {
    maxBytes: number;
    multipartThresholdBytes: number;
  };
};

type UploadCompleteResponse = {
  hostedFile: HostedFileRecord;
  hostedDownloadUrl: string;
};

type HostedFileUploaderProps = {
  contentId: number;
  role: UserRole;
  storageFolder: string;
  initialFiles: HostedFileRecord[];
};

const MULTIPART_CHUNK_SIZE = 16 * 1024 * 1024;

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

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function HostedFileUploader({
  contentId,
  role,
  storageFolder,
  initialFiles
}: HostedFileUploaderProps) {
  const [files, setFiles] = useState(initialFiles);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<{
    fileName: string;
    uploadedBytes: number;
    totalBytes: number;
    step: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canUpload = role === "ADMIN" || role === "AUDIT";

  const progressPercent = useMemo(() => {
    if (!progress || progress.totalBytes <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round((progress.uploadedBytes / progress.totalBytes) * 100)));
  }, [progress]);

  async function uploadSingleFile(file: File, init: UploadInitResponse) {
    if (!init.directUploadUrl) {
      throw new Error("Missing direct upload URL");
    }

    setProgress({
      fileName: file.name,
      uploadedBytes: 0,
      totalBytes: file.size,
      step: "Uploading file"
    });

    const uploadResponse = await fetch(init.directUploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream"
      },
      body: file
    });

    if (!uploadResponse.ok) {
      throw new Error(`Direct upload failed with ${uploadResponse.status}`);
    }

    setProgress({
      fileName: file.name,
      uploadedBytes: file.size,
      totalBytes: file.size,
      step: "Finalizing upload"
    });

    const completeResponse = await fetch(`/api/admin/contents/${contentId}/hosted-files/${init.upload.id}/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });

    if (!completeResponse.ok) {
      const data = (await completeResponse.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error || "Failed to finalize upload");
    }

    const data = (await completeResponse.json()) as UploadCompleteResponse;
    setFiles((current) => [data.hostedFile, ...current.filter((item) => item.id !== data.hostedFile.id)]);
    window.dispatchEvent(
      new CustomEvent("kkd:add-download-link", {
        detail: { url: data.hostedDownloadUrl }
      })
    );
  }

  async function uploadMultipartFile(file: File, init: UploadInitResponse) {
    const parts: Array<{ ETag: string; PartNumber: number }> = [];
    let uploadedBytes = 0;
    const totalParts = Math.ceil(file.size / MULTIPART_CHUNK_SIZE);

    for (let index = 0; index < totalParts; index += 1) {
      const partNumber = index + 1;
      const start = index * MULTIPART_CHUNK_SIZE;
      const end = Math.min(file.size, start + MULTIPART_CHUNK_SIZE);
      const chunk = file.slice(start, end);

      setProgress({
        fileName: file.name,
        uploadedBytes,
        totalBytes: file.size,
        step: `Uploading part ${partNumber}/${totalParts}`
      });

      const partUrlResponse = await fetch(
        `/api/admin/contents/${contentId}/hosted-files/${init.upload.id}/part-url`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            partNumber
          })
        }
      );

      if (!partUrlResponse.ok) {
        const data = (await partUrlResponse.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Failed to prepare multipart upload");
      }

      const { url } = (await partUrlResponse.json()) as { url: string };
      const uploadResponse = await fetch(url, {
        method: "PUT",
        body: chunk
      });

      if (!uploadResponse.ok) {
        throw new Error(`Multipart upload failed on part ${partNumber}`);
      }

      const etag = uploadResponse.headers.get("etag")?.replaceAll('"', "");
      if (!etag) {
        throw new Error("Missing ETag header. R2 CORS must expose ETag for multipart uploads.");
      }

      parts.push({
        ETag: etag,
        PartNumber: partNumber
      });
      uploadedBytes += chunk.size;
    }

    setProgress({
      fileName: file.name,
      uploadedBytes: file.size,
      totalBytes: file.size,
      step: "Finalizing upload"
    });

    const completeResponse = await fetch(`/api/admin/contents/${contentId}/hosted-files/${init.upload.id}/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        parts
      })
    });

    if (!completeResponse.ok) {
      const data = (await completeResponse.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error || "Failed to finalize multipart upload");
    }

    const data = (await completeResponse.json()) as UploadCompleteResponse;
    setFiles((current) => [data.hostedFile, ...current.filter((item) => item.id !== data.hostedFile.id)]);
    window.dispatchEvent(
      new CustomEvent("kkd:add-download-link", {
        detail: { url: data.hostedDownloadUrl }
      })
    );
  }

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !canUpload) {
      return;
    }

    setMessage("");
    setError("");

    try {
      const initResponse = await fetch(`/api/admin/contents/${contentId}/hosted-files/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          byteSize: file.size
        })
      });

      if (!initResponse.ok) {
        const data = (await initResponse.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Failed to start upload");
      }

      const init = (await initResponse.json()) as UploadInitResponse;
      if (init.upload.uploadMethod === "SINGLE") {
        await uploadSingleFile(file, init);
      } else {
        await uploadMultipartFile(file, init);
      }

      setMessage(`Uploaded ${file.name} successfully.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
    } finally {
      setProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="hosted-files-manager">
      <div className="split hosted-files-toolbar">
        <div>
          <strong>R2 folder</strong>
          <small>
            Files for this content will be stored under <code>{`uploadfiles/${storageFolder}/`}</code>.
          </small>
        </div>
        {canUpload ? (
          <label className="button hosted-file-upload-button">
            Upload Shared File
            <input
              ref={fileInputRef}
              type="file"
              className="hidden-file-input"
              onChange={handleFileSelection}
            />
          </label>
        ) : null}
      </div>

      {progress ? (
        <div className="hosted-upload-progress">
          <div className="split">
            <strong>{progress.fileName}</strong>
            <span>{progressPercent}%</span>
          </div>
          <small>
            {progress.step} · {formatBytes(progress.uploadedBytes)} / {formatBytes(progress.totalBytes)}
          </small>
          <div className="hosted-upload-progress-bar">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      ) : null}

      {message ? <div className="notice">{message}</div> : null}
      {error ? <div className="notice">{error}</div> : null}

      {files.length ? (
        <div className="hosted-file-list">
          {files.map((file) => (
            <div key={file.id} className="hosted-file-card">
              <strong>{file.fileName}</strong>
              <small>{file.mimeType || "application/octet-stream"}</small>
              <small>{formatBytes(file.byteSize)}</small>
              <small>{file.objectKey}</small>
              <small>
                Uploaded by {file.uploadedBy.username ?? file.uploadedBy.email} on {formatDate(file.createdAt)}
              </small>
            </div>
          ))}
        </div>
      ) : (
        <div className="notice">
          No hosted files yet. Audit staff can upload shared files here without leaving this edit page.
        </div>
      )}
    </div>
  );
}
