"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { UserRole } from "@prisma/client";

type ManagedImageRecord = {
  id: number;
  imageUrl: string;
  sortOrder?: number;
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
  contentImage: ManagedImageRecord;
  imageUrl: string;
};

type DeleteImageResponse = {
  removedImageId: number;
  removedImageUrl: string;
  warning: string | null;
};

type ContentImageUrlsEditorProps = {
  contentId?: number;
  role: UserRole;
  storageFolder?: string;
  coverImageUrl?: string;
  initialImageUrls: string[];
  initialImages?: ManagedImageRecord[];
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

function normalizeEditableUrls(initialImageUrls: string[]) {
  const urls = initialImageUrls.length ? [...initialImageUrls] : ["", "", ""];
  while (urls.length < 3) {
    urls.push("");
  }
  return urls;
}

function normalizeManagedImages(initialImages?: ManagedImageRecord[]) {
  return [...(initialImages ?? [])].sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
}

function insertUploadedImage(current: ManagedImageRecord[], nextImage: ManagedImageRecord) {
  if (!nextImage.imageUrl.trim()) {
    return current;
  }

  const next = [...current, nextImage];
  return next.filter((item, index, array) => array.findIndex((entry) => entry.id === item.id) === index);
}

export function ContentImageUrlsEditor({
  contentId,
  role,
  storageFolder,
  coverImageUrl,
  initialImageUrls,
  initialImages
}: ContentImageUrlsEditorProps) {
  const isManagedMode = Boolean(contentId);
  const [managedImages, setManagedImages] = useState(() => normalizeManagedImages(initialImages));
  const [editableUrls, setEditableUrls] = useState(() => normalizeEditableUrls(initialImageUrls));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<{
    fileName: string;
    uploadedBytes: number;
    totalBytes: number;
    step: string;
  } | null>(null);
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canUpload = isManagedMode && (role === "ADMIN" || role === "AUDIT");
  const canDelete = role === "ADMIN";

  const progressPercent = useMemo(() => {
    if (!progress || progress.totalBytes <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round((progress.uploadedBytes / progress.totalBytes) * 100)));
  }, [progress]);

  useEffect(() => {
    if (isManagedMode) {
      setManagedImages(normalizeManagedImages(initialImages));
      return;
    }

    setEditableUrls(normalizeEditableUrls(initialImageUrls));
  }, [initialImageUrls, initialImages, isManagedMode]);

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
    setManagedImages((current) => insertUploadedImage(current, data.contentImage));
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
    setManagedImages((current) => insertUploadedImage(current, data.contentImage));
  }

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (!selectedFiles.length || !canUpload || !contentId) {
      return;
    }

    setMessage("");
    setError("");

    try {
      for (const file of selectedFiles) {
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
      }

      setMessage(
        selectedFiles.length === 1
          ? `Uploaded ${selectedFiles[0].name} successfully.`
          : `Uploaded ${selectedFiles.length} images successfully.`
      );
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
    } finally {
      setProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleDeleteImage(image: ManagedImageRecord) {
    if (!contentId || !canDelete || deletingImageId) {
      return;
    }

    const confirmed = window.confirm(`Delete image "${image.imageUrl}" from this content?`);
    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");
    setDeletingImageId(image.id);

    try {
      const response = await fetch(`/api/admin/contents/${contentId}/images/file/${image.id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Failed to delete image");
      }

      const data = (await response.json()) as DeleteImageResponse;
      setManagedImages((current) => current.filter((item) => item.id !== data.removedImageId));
      setMessage(
        data.warning ? `Deleted image successfully. ${data.warning}` : `Deleted image successfully.`
      );
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Delete failed");
    } finally {
      setDeletingImageId(null);
    }
  }

  const managedImageRows = managedImages.length ? (
    <div className="hosted-file-list">
      {managedImages.map((image, index) => {
        const isCoverImage = index === 0 || image.imageUrl === coverImageUrl;
        return (
          <div key={image.id} className="hosted-file-card">
            <div className="split hosted-file-card-header">
              <div>
                <strong>{isCoverImage ? "Cover Image" : `Image ${index + 1}`}</strong>
                <small style={{ wordBreak: "break-all" }}>{image.imageUrl}</small>
              </div>
              {canDelete && !isCoverImage ? (
                <button
                  type="button"
                  className="button secondary hosted-file-delete-button"
                  onClick={() => handleDeleteImage(image)}
                  disabled={deletingImageId === image.id}
                >
                  {deletingImageId === image.id ? "Deleting..." : "Delete"}
                </button>
              ) : null}
            </div>
            <input type="hidden" name="imageUrls" value={image.imageUrl} />
          </div>
        );
      })}
    </div>
  ) : (
    <div className="notice">No images yet. Upload images or save the content first.</div>
  );

  return (
    <div className="field">
      <div className="split">
        <span>Image URLs</span>
        {canUpload ? (
          <label className="button hosted-file-upload-button">
            Upload Images
            <input
              ref={fileInputRef}
              type="file"
              className="hidden-file-input"
              accept="image/*"
              multiple
              onChange={handleFileSelection}
            />
          </label>
        ) : null}
      </div>

      {isManagedMode ? (
        managedImageRows
      ) : (
        <div className="grid">
          {editableUrls.map((imageUrl, index) => (
            <input
              key={`${index}-${imageUrl}`}
              name="imageUrls"
              value={imageUrl}
              onChange={(event) => {
                const next = event.target.value;
                setEditableUrls((current) => {
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
      )}

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
            {progress.step} ﾂｷ {formatBytes(progress.uploadedBytes)} / {formatBytes(progress.totalBytes)}
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
