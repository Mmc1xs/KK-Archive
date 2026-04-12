"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { UserRole } from "@prisma/client";

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
  imageUrl: string;
};

type ContentImageUrlsEditorProps = {
  contentId?: number;
  role: UserRole;
  storageFolder?: string;
  initialImageUrls: string[];
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

function normalizeImageUrls(initialImageUrls: string[]) {
  const urls = initialImageUrls.length ? [...initialImageUrls] : ["", "", ""];
  while (urls.length < 3) {
    urls.push("");
  }
  return urls;
}

function insertUploadedUrl(current: string[], nextUrl: string) {
  const normalized = nextUrl.trim();
  if (!normalized) {
    return current;
  }

  const next = [...current];
  const emptyIndex = next.findIndex((item) => !item.trim());
  if (emptyIndex >= 0) {
    next[emptyIndex] = normalized;
  } else {
    next.push(normalized);
  }

  return next.filter((item, index, array) => array.indexOf(item) === index);
}

export function ContentImageUrlsEditor({
  contentId,
  role,
  storageFolder,
  initialImageUrls
}: ContentImageUrlsEditorProps) {
  const [imageUrls, setImageUrls] = useState(() => normalizeImageUrls(initialImageUrls));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<{
    fileName: string;
    uploadedBytes: number;
    totalBytes: number;
    step: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canUpload = Boolean(contentId) && (role === "ADMIN" || role === "AUDIT");

  const progressPercent = useMemo(() => {
    if (!progress || progress.totalBytes <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round((progress.uploadedBytes / progress.totalBytes) * 100)));
  }, [progress]);

  useEffect(() => {
    setImageUrls(normalizeImageUrls(initialImageUrls));
  }, [initialImageUrls]);

  async function uploadSingleImage(file: File, init: UploadInitResponse) {
    if (!init.directUploadUrl) {
      throw new Error("Missing direct upload URL");
    }

    setProgress({
      fileName: file.name,
      uploadedBytes: 0,
      totalBytes: file.size,
      step: "Uploading image"
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

    const completeResponse = await fetch(`/api/admin/contents/${contentId}/images/${init.upload.id}/complete`, {
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
    setImageUrls((current) => insertUploadedUrl(current, data.imageUrl));
  }

  async function uploadMultipartImage(file: File, init: UploadInitResponse) {
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

      const partUrlResponse = await fetch(`/api/admin/contents/${contentId}/images/${init.upload.id}/part-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          partNumber
        })
      });

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

    const completeResponse = await fetch(`/api/admin/contents/${contentId}/images/${init.upload.id}/complete`, {
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
    setImageUrls((current) => insertUploadedUrl(current, data.imageUrl));
  }

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !canUpload || !contentId) {
      return;
    }

    setMessage("");
    setError("");

    try {
      const initResponse = await fetch(`/api/admin/contents/${contentId}/images/init`, {
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
        await uploadSingleImage(file, init);
      } else {
        await uploadMultipartImage(file, init);
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
    <div className="field">
      <div className="split">
        <span>Image URLs</span>
        {canUpload ? (
          <label className="button hosted-file-upload-button">
            Upload Image
            <input ref={fileInputRef} type="file" className="hidden-file-input" accept="image/*" onChange={handleFileSelection} />
          </label>
        ) : null}
      </div>
      <div className="grid">
        {imageUrls.map((imageUrl, index) => (
          <input
            key={`${index}-${imageUrl}`}
            name="imageUrls"
            value={imageUrl}
            onChange={(event) => {
              const next = event.target.value;
              setImageUrls((current) => {
                const updated = [...current];
                updated[index] = next;
                return updated;
              });
              if (next.trim()) {
                setError("");
              }
            }}
            placeholder={`Image URL ${index + 1}`}
            required={index === 0}
          />
        ))}
      </div>

      {contentId ? (
        <small>
          Uploaded images will be stored under <code>{`contents/${storageFolder || contentId}/`}</code> in R2.
        </small>
      ) : (
        <small>Save the content first to enable image uploads to R2.</small>
      )}

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
    </div>
  );
}
