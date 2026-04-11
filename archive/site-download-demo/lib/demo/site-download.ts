import { Transform } from "stream";
import { Prisma, SiteDownloadDemoStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { buildContentFileDownloadPath, buildLegacyContentFileDownloadPath } from "@/lib/downloads/content-file-token";
import { inspectTelegramSource, spawnTelegramMediaStream, type TelegramMediaCandidate } from "@/lib/demo/telegram-bridge";
import { buildR2PublicUrl, listR2ObjectsByPrefix, uploadR2Object } from "@/lib/storage/r2";
import {
  buildHostedFileObjectKey,
  ensureContentStorageFolder,
  resolveContentStorageFolderValue,
  sanitizeUploadFileName
} from "@/lib/uploads";

function isTelegramUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "t.me" || parsed.hostname === "telegram.me" || parsed.hostname.endsWith(".t.me");
  } catch {
    return false;
  }
}

function splitBaseNameAndExtension(fileName: string) {
  const extIndex = fileName.lastIndexOf(".");
  if (extIndex <= 0) {
    return { baseName: fileName, extension: "" };
  }

  return {
    baseName: fileName.slice(0, extIndex),
    extension: fileName.slice(extIndex)
  };
}

function inferMimeTypeFromFileName(fileName: string) {
  const normalized = fileName.toLowerCase();

  if (normalized.endsWith(".png")) {
    return "image/png";
  }

  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (normalized.endsWith(".webp")) {
    return "image/webp";
  }

  if (normalized.endsWith(".gif")) {
    return "image/gif";
  }

  if (normalized.endsWith(".zip")) {
    return "application/zip";
  }

  if (normalized.endsWith(".rar")) {
    return "application/vnd.rar";
  }

  if (normalized.endsWith(".7z")) {
    return "application/x-7z-compressed";
  }

  return "application/octet-stream";
}

export type SiteDownloadDemoUploadProgress = {
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

export type SiteDownloadDemoPreparedUploadPlan = {
  selection: TelegramMediaCandidate;
  index: number;
  objectKey: string;
};

export function parseTelegramMediaSelections(rawValues: unknown[]) {
  const parsedSelections: TelegramMediaCandidate[] = [];

  for (const rawValue of rawValues) {
    try {
      const parsed =
        typeof rawValue === "string" ? (JSON.parse(rawValue) as Partial<TelegramMediaCandidate>) : (rawValue as Partial<TelegramMediaCandidate>);
      if (
        !parsed ||
        typeof parsed.targetUrl !== "string" ||
        typeof parsed.linkLabel !== "string" ||
        !Number.isInteger(parsed.messageId) ||
        typeof parsed.fileName !== "string" ||
        typeof parsed.mimeType !== "string" ||
        !Number.isFinite(parsed.byteSize) ||
        typeof parsed.caption !== "string" ||
        (parsed.kind !== "photo" && parsed.kind !== "document")
      ) {
        continue;
      }

      const messageId = parsed.messageId as number;
      const byteSize = parsed.byteSize as number;

      parsedSelections.push({
        targetUrl: parsed.targetUrl,
        linkLabel: parsed.linkLabel,
        messageId,
        groupedId: Number.isInteger(parsed.groupedId) ? (parsed.groupedId as number) : null,
        fileName: parsed.fileName,
        mimeType: parsed.mimeType,
        byteSize,
        caption: parsed.caption,
        kind: parsed.kind
      });
    } catch {
      continue;
    }
  }

  return parsedSelections;
}

export function getTelegramSourceLink(downloadLinks: Array<{ url: string }>) {
  return downloadLinks.map((item) => item.url).find(isTelegramUrl) ?? null;
}

const SITE_DOWNLOAD_DEMO_QUEUE_SELECT = {
  id: true,
  title: true,
  slug: true,
  publishStatus: true,
  reviewStatus: true,
  updatedAt: true,
  downloadLinks: {
    orderBy: { sortOrder: "asc" },
    select: {
      url: true
    }
  },
  siteDownloadDemo: {
    select: {
      status: true,
      errorMessage: true,
      updatedAt: true
    }
  }
} satisfies Prisma.ContentSelect;

const SITE_DOWNLOAD_DEMO_CONTENT_SELECT = {
  id: true,
  title: true,
  slug: true,
  publishStatus: true,
  reviewStatus: true,
  storageFolder: true,
  coverImageUrl: true,
  downloadLinks: {
    orderBy: { sortOrder: "asc" },
    select: {
      url: true
    }
  },
  hostedFiles: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      fileName: true,
      objectKey: true,
      mimeType: true,
      byteSize: true,
      createdAt: true
    }
  },
  siteDownloadDemo: {
    select: {
      status: true,
      telegramSourceUrl: true,
      resolvedTargetUrls: true,
      selectedFilesJson: true,
      errorMessage: true,
      ignoredAt: true,
      completedAt: true,
      updatedAt: true
    }
  }
} satisfies Prisma.ContentSelect;

export async function getSiteDownloadDemoQueuePage(options?: {
  page?: number;
  pageSize?: number;
}) {
  const page = Number.isInteger(options?.page) && (options?.page ?? 0) > 0 ? (options?.page as number) : 1;
  const pageSize =
    Number.isInteger(options?.pageSize) && (options?.pageSize ?? 0) > 0 ? (options?.pageSize as number) : 20;

  const where: Prisma.ContentWhereInput = {
    hostedFiles: {
      none: {}
    },
    AND: [
      {
        OR: [
          {
            downloadLinks: {
              some: {
                url: {
                  startsWith: "https://t.me/"
                }
              }
            }
          },
          {
            downloadLinks: {
              some: {
                url: {
                  startsWith: "https://telegram.me/"
                }
              }
            }
          }
        ]
      },
      {
        OR: [
          {
            siteDownloadDemo: {
              is: null
            }
          },
          {
            siteDownloadDemo: {
              is: {
                status: {
                  in: [SiteDownloadDemoStatus.PENDING, SiteDownloadDemoStatus.FAILED]
                }
              }
            }
          }
        ]
      }
    ]
  };

  const [totalCount, items] = await Promise.all([
    db.content.count({ where }),
    db.content.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: SITE_DOWNLOAD_DEMO_QUEUE_SELECT
    })
  ]);

  return {
    items: items.map((item) => ({
      ...item,
      telegramSourceUrl: getTelegramSourceLink(item.downloadLinks)
    })),
    totalCount,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize))
  };
}

export async function getSiteDownloadDemoContent(contentId: number) {
  const content = await db.content.findUnique({
    where: {
      id: contentId
    },
    select: SITE_DOWNLOAD_DEMO_CONTENT_SELECT
  });

  if (!content) {
    return null;
  }

  return {
    ...content,
    telegramSourceUrl: getTelegramSourceLink(content.downloadLinks)
  };
}

export async function listDetectedSiteDownloadR2Objects(contentId: number) {
  const content = await db.content.findUnique({
    where: { id: contentId },
    select: {
      id: true,
      storageFolder: true,
      coverImageUrl: true,
      images: {
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: {
          imageUrl: true
        }
      }
    }
  });

  if (!content) {
    return [];
  }

  const storageFolder = resolveContentStorageFolderValue(content);
  const prefix = `uploadfiles/${storageFolder}/`;
  const existingObjectKeys = new Set(
    (
      await db.contentFile.findMany({
        where: { contentId },
        select: { objectKey: true }
      })
    ).map((item) => item.objectKey)
  );

  const objects = await listR2ObjectsByPrefix(prefix);
  return objects
    .filter((item) => !existingObjectKeys.has(item.key))
    .map((item) => ({
      objectKey: item.key,
      fileName: item.key.slice(prefix.length) || item.key.split("/").pop() || item.key,
      byteSize: item.size,
      mimeType: inferMimeTypeFromFileName(item.key),
      lastModified: item.lastModified
    }));
}

export async function inspectSiteDownloadDemoSource(sourceUrl: string) {
  return inspectTelegramSource(sourceUrl);
}

async function buildUniqueDemoHostedFileObjectKey(
  contentId: number,
  storageFolder: string,
  fileName: string,
  reservedObjectKeys?: Set<string>
) {
  const safeFileName = sanitizeUploadFileName(fileName);
  const { baseName, extension } = splitBaseNameAndExtension(safeFileName);

  let candidate = buildHostedFileObjectKey(storageFolder, safeFileName);
  let counter = 2;

  while (true) {
    const [existingContentFile, existingStaffUpload] = await Promise.all([
      db.contentFile.findFirst({
        where: {
          contentId,
          objectKey: candidate
        },
        select: {
          id: true
        }
      }),
      db.staffUpload.findFirst({
        where: {
          contentId,
          objectKey: candidate
        },
        select: {
          id: true
        }
      })
    ]);

    if (!existingContentFile && !existingStaffUpload && !reservedObjectKeys?.has(candidate)) {
      return candidate;
    }

    candidate = buildHostedFileObjectKey(storageFolder, `${baseName}-${counter}${extension}`);
    counter += 1;
  }
}

export async function registerUploadedDemoHostedFile(params: {
  contentId: number;
  fileName: string;
  objectKey: string;
  mimeType: string;
  byteSize: number;
  uploadedByUserId: number;
}) {
  const maxFileSortOrder = await db.contentFile.aggregate({
    where: {
      contentId: params.contentId
    },
    _max: {
      sortOrder: true
    }
  });

  const existingHostedFile = await db.contentFile.findFirst({
    where: {
      contentId: params.contentId,
      objectKey: params.objectKey
    },
    select: {
      id: true
    }
  });
  const hostedFile = existingHostedFile
    ? await db.contentFile.update({
        where: {
          id: existingHostedFile.id
        },
        data: {
          fileName: params.fileName,
          mimeType: params.mimeType,
          byteSize: params.byteSize,
          uploadedByUserId: params.uploadedByUserId
        }
      })
    : await db.contentFile.create({
        data: {
          contentId: params.contentId,
          fileName: params.fileName,
          objectKey: params.objectKey,
          mimeType: params.mimeType,
          byteSize: params.byteSize,
          sortOrder: (maxFileSortOrder._max.sortOrder ?? -1) + 1,
          uploadedByUserId: params.uploadedByUserId
        }
      });

  const hostedDownloadUrl = buildContentFileDownloadPath(hostedFile.id);
  const legacyHostedDownloadUrlById = buildLegacyContentFileDownloadPath(hostedFile.id);
  const publicR2Url = buildR2PublicUrl(params.objectKey);
  const existingDownloadLink = await db.contentDownloadLink.findFirst({
    where: {
      contentId: params.contentId,
      url: hostedDownloadUrl
    },
    select: {
      id: true
    }
  });
  const legacyIdDownloadLink = await db.contentDownloadLink.findFirst({
    where: {
      contentId: params.contentId,
      url: legacyHostedDownloadUrlById
    },
    select: {
      id: true
    }
  });
  const legacyPublicDownloadLink = await db.contentDownloadLink.findFirst({
    where: {
      contentId: params.contentId,
      url: publicR2Url
    },
    select: {
      id: true
    }
  });

  if (!existingDownloadLink && legacyIdDownloadLink) {
    await db.contentDownloadLink.update({
      where: {
        id: legacyIdDownloadLink.id
      },
      data: {
        url: hostedDownloadUrl
      }
    });
  } else if (!existingDownloadLink && legacyPublicDownloadLink) {
    await db.contentDownloadLink.update({
      where: {
        id: legacyPublicDownloadLink.id
      },
      data: {
        url: hostedDownloadUrl
      }
    });
  } else if (!existingDownloadLink) {
    const maxDownloadSortOrder = await db.contentDownloadLink.aggregate({
      where: {
        contentId: params.contentId
      },
      _max: {
        sortOrder: true
      }
    });

    await db.contentDownloadLink.create({
      data: {
        contentId: params.contentId,
        url: hostedDownloadUrl,
        sortOrder: (maxDownloadSortOrder._max.sortOrder ?? -1) + 1
      }
    });
  }

  await db.contentDownloadLink.deleteMany({
    where: {
      contentId: params.contentId,
      url: {
        in: [legacyHostedDownloadUrlById, publicR2Url]
      }
    }
  });

  return {
    hostedFile,
    hostedDownloadUrl
  };
}

export async function prepareSiteDownloadDemoUploadPlans(params: {
  contentId: number;
  selections: TelegramMediaCandidate[];
}) {
  const storageFolder = await ensureContentStorageFolder(params.contentId);
  if (!storageFolder) {
    throw new Error("Unable to resolve a storage folder for this content");
  }

  const reservedObjectKeys = new Set<string>();
  const plans: SiteDownloadDemoPreparedUploadPlan[] = [];

  for (const [index, selection] of params.selections.entries()) {
    const objectKey = await buildUniqueDemoHostedFileObjectKey(
      params.contentId,
      storageFolder,
      selection.fileName,
      reservedObjectKeys
    );
    reservedObjectKeys.add(objectKey);
    plans.push({
      selection,
      index,
      objectKey
    });
  }

  return {
    storageFolder,
    plans
  };
}

export async function recordSiteDownloadDemoUploadSuccess(params: {
  contentId: number;
  telegramSourceUrl: string;
  selections: TelegramMediaCandidate[];
}) {
  await db.contentSiteDownloadDemo.upsert({
    where: {
      contentId: params.contentId
    },
    update: {
      status: SiteDownloadDemoStatus.PENDING,
      telegramSourceUrl: params.telegramSourceUrl,
      resolvedTargetUrls: JSON.stringify([...new Set(params.selections.map((item) => item.targetUrl))]),
      selectedFilesJson: JSON.stringify(params.selections),
      errorMessage: null,
      ignoredByUserId: null,
      ignoredAt: null,
      completedByUserId: null,
      completedAt: null
    },
    create: {
      contentId: params.contentId,
      status: SiteDownloadDemoStatus.PENDING,
      telegramSourceUrl: params.telegramSourceUrl,
      resolvedTargetUrls: JSON.stringify([...new Set(params.selections.map((item) => item.targetUrl))]),
      selectedFilesJson: JSON.stringify(params.selections)
    }
  });
}

export async function recordSiteDownloadDemoUploadFailure(params: {
  contentId: number;
  telegramSourceUrl: string;
  selections: TelegramMediaCandidate[];
  errorMessage: string;
}) {
  await db.contentSiteDownloadDemo.upsert({
    where: {
      contentId: params.contentId
    },
    update: {
      status: SiteDownloadDemoStatus.FAILED,
      telegramSourceUrl: params.telegramSourceUrl,
      resolvedTargetUrls: JSON.stringify([...new Set(params.selections.map((item) => item.targetUrl))]),
      selectedFilesJson: JSON.stringify(params.selections),
      errorMessage: params.errorMessage,
      completedByUserId: null,
      completedAt: null
    },
    create: {
      contentId: params.contentId,
      status: SiteDownloadDemoStatus.FAILED,
      telegramSourceUrl: params.telegramSourceUrl,
      resolvedTargetUrls: JSON.stringify([...new Set(params.selections.map((item) => item.targetUrl))]),
      selectedFilesJson: JSON.stringify(params.selections),
      errorMessage: params.errorMessage
    }
  });
}

export async function syncSiteDownloadDemoHostedFilesFromR2(params: {
  contentId: number;
  actorUserId: number;
}) {
  const detectedObjects = await listDetectedSiteDownloadR2Objects(params.contentId);

  for (const object of detectedObjects) {
    await registerUploadedDemoHostedFile({
      contentId: params.contentId,
      fileName: sanitizeUploadFileName(object.fileName),
      objectKey: object.objectKey,
      mimeType: object.mimeType,
      byteSize: object.byteSize,
      uploadedByUserId: params.actorUserId
    });
  }

  return detectedObjects.length;
}

export async function markSiteDownloadDemoIgnored(params: {
  contentId: number;
  actorUserId: number;
  telegramSourceUrl: string;
}) {
  await db.contentSiteDownloadDemo.upsert({
    where: {
      contentId: params.contentId
    },
    update: {
      status: SiteDownloadDemoStatus.IGNORED,
      telegramSourceUrl: params.telegramSourceUrl,
      errorMessage: null,
      ignoredByUserId: params.actorUserId,
      ignoredAt: new Date(),
      completedByUserId: null,
      completedAt: null
    },
    create: {
      contentId: params.contentId,
      status: SiteDownloadDemoStatus.IGNORED,
      telegramSourceUrl: params.telegramSourceUrl,
      ignoredByUserId: params.actorUserId,
      ignoredAt: new Date()
    }
  });
}

export async function uploadSiteDownloadDemoSelections(params: {
  contentId: number;
  actorUserId: number;
  telegramSourceUrl: string;
  selections: TelegramMediaCandidate[];
  onProgress?: (progress: SiteDownloadDemoUploadProgress) => void;
}) {
  const maxConcurrentUploads = 3;
  const totalBytes = params.selections.reduce((sum, item) => sum + Math.max(0, item.byteSize || 0), 0);
  const uploadStartedAt = Date.now();
  const { plans: uploadPlans } = await prepareSiteDownloadDemoUploadPlans({
    contentId: params.contentId,
    selections: params.selections
  });

  const fileStates = uploadPlans.map((plan) => ({
    fileName: plan.selection.fileName,
    fileIndex: plan.index + 1,
    telegramDownloadedBytes: 0,
    uploadedBytes: 0,
    totalBytes: Math.max(0, plan.selection.byteSize || 0),
    telegramSpeedBytesPerSecond: 0,
    speedBytesPerSecond: 0,
    status: "queued" as "queued" | "uploading" | "uploaded" | "finalizing" | "done",
    startedAt: 0,
    lastTelegramSampleAt: 0,
    lastTelegramSampleBytes: 0,
    lastUploadSampleAt: 0,
    lastUploadSampleBytes: 0
  }));

  let lastProgressEmitAt = 0;

  const emitProgress = (
    phase: SiteDownloadDemoUploadProgress["phase"],
    currentFileIndex: number,
    currentFileName: string,
    force = false
  ) => {
    const now = Date.now();
    if (!force && now - lastProgressEmitAt < 150) {
      return;
    }

    lastProgressEmitAt = now;
    const totalTelegramDownloadedBytes = fileStates.reduce((sum, item) => sum + item.telegramDownloadedBytes, 0);
    const totalUploadedBytes = fileStates.reduce((sum, item) => sum + item.uploadedBytes, 0);
    const activeFiles = fileStates
      .filter((item) => item.status === "uploading")
      .map((item) => ({
        fileName: item.fileName,
        fileIndex: item.fileIndex,
        telegramDownloadedBytes: item.telegramDownloadedBytes,
        uploadedBytes: item.uploadedBytes,
        totalBytes: item.totalBytes,
        telegramSpeedBytesPerSecond: item.telegramSpeedBytesPerSecond,
        speedBytesPerSecond: item.speedBytesPerSecond
      }))
      .sort((a, b) => a.fileIndex - b.fileIndex);
    const currentFileState =
      fileStates[currentFileIndex - 1] ??
      activeFiles[0] ?? {
        fileName: currentFileName,
        fileIndex: currentFileIndex,
        telegramDownloadedBytes: 0,
        uploadedBytes: 0,
        totalBytes: 0,
        telegramSpeedBytesPerSecond: 0,
        speedBytesPerSecond: 0
      };

    params.onProgress?.({
      phase,
      currentFileName,
      currentFileIndex,
      totalFiles: params.selections.length,
      completedFiles: fileStates.filter((item) => item.status === "uploaded" || item.status === "done").length,
      parallelUploads: Math.min(maxConcurrentUploads, params.selections.length),
      fileUploadedBytes: currentFileState.uploadedBytes,
      fileTelegramDownloadedBytes: currentFileState.telegramDownloadedBytes,
      fileTotalBytes: currentFileState.totalBytes,
      totalTelegramDownloadedBytes,
      totalUploadedBytes,
      totalBytes,
      elapsedMs: Math.max(1, now - uploadStartedAt),
      totalTelegramSpeedBytesPerSecond: activeFiles.reduce((sum, item) => sum + item.telegramSpeedBytesPerSecond, 0),
      totalUploadSpeedBytesPerSecond: activeFiles.reduce((sum, item) => sum + item.speedBytesPerSecond, 0),
      activeFiles
    });
  };

  try {
    let nextPlanIndex = 0;
    const uploadWorkers = Array.from({
      length: Math.min(maxConcurrentUploads, uploadPlans.length)
    }, async () => {
      while (true) {
        const workerPlan = uploadPlans[nextPlanIndex];
        nextPlanIndex += 1;

        if (!workerPlan) {
          return;
        }

        const { selection, index, objectKey } = workerPlan;
        const state = fileStates[index];
        state.status = "uploading";
        state.startedAt = Date.now();
        state.lastTelegramSampleAt = state.startedAt;
        state.lastUploadSampleAt = state.startedAt;
        emitProgress("uploading", index + 1, selection.fileName, true);

        const streamHandle = spawnTelegramMediaStream({
          url: selection.targetUrl,
          messageId: selection.messageId
        });
        const progressStream = new Transform({
          highWaterMark: 1024 * 1024,
          transform(chunk, encoding, callback) {
            const chunkSize = typeof chunk === "string" ? Buffer.byteLength(chunk, encoding as BufferEncoding) : chunk.length;
            state.uploadedBytes += chunkSize;
            const now = Date.now();
            const elapsedSinceLastSample = now - state.lastUploadSampleAt;
            if (elapsedSinceLastSample >= 150) {
              const deltaBytes = state.uploadedBytes - state.lastUploadSampleBytes;
              const instantSpeed = elapsedSinceLastSample > 0 ? (deltaBytes * 1000) / elapsedSinceLastSample : 0;
              state.speedBytesPerSecond = state.speedBytesPerSecond
                ? state.speedBytesPerSecond * 0.55 + instantSpeed * 0.45
                : instantSpeed;
              state.lastUploadSampleAt = now;
              state.lastUploadSampleBytes = state.uploadedBytes;
            }

            emitProgress("uploading", index + 1, selection.fileName);
            callback(null, chunk);
          }
        });

        streamHandle.stream.on("data", (chunk: Buffer | string) => {
          const chunkSize = typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
          state.telegramDownloadedBytes += chunkSize;
          const now = Date.now();
          const elapsedSinceLastSample = now - state.lastTelegramSampleAt;
          if (elapsedSinceLastSample >= 150) {
            const deltaBytes = state.telegramDownloadedBytes - state.lastTelegramSampleBytes;
            const instantSpeed = elapsedSinceLastSample > 0 ? (deltaBytes * 1000) / elapsedSinceLastSample : 0;
            state.telegramSpeedBytesPerSecond = state.telegramSpeedBytesPerSecond
              ? state.telegramSpeedBytesPerSecond * 0.55 + instantSpeed * 0.45
              : instantSpeed;
            state.lastTelegramSampleAt = now;
            state.lastTelegramSampleBytes = state.telegramDownloadedBytes;
          }

          emitProgress("uploading", index + 1, selection.fileName);
        });

        streamHandle.stream.on("error", (error) => {
          progressStream.destroy(error);
        });

        streamHandle.stream.pipe(progressStream);

        try {
          await uploadR2Object({
            key: objectKey,
            body: progressStream,
            contentType: selection.mimeType || "application/octet-stream",
            contentLength: selection.byteSize || undefined
          });
          await streamHandle.wait();
          state.telegramDownloadedBytes = state.totalBytes || state.telegramDownloadedBytes;
          state.uploadedBytes = state.totalBytes;
          const totalElapsedMs = Math.max(1, Date.now() - state.startedAt);
          state.telegramSpeedBytesPerSecond =
            state.telegramDownloadedBytes > 0 ? (state.telegramDownloadedBytes * 1000) / totalElapsedMs : 0;
          state.speedBytesPerSecond = state.uploadedBytes > 0 ? (state.uploadedBytes * 1000) / totalElapsedMs : 0;
          state.status = "uploaded";
          emitProgress("uploading", index + 1, selection.fileName, true);
        } catch (error) {
          streamHandle.kill();
          progressStream.destroy();
          throw error;
        }
      }
    });

    await Promise.all(uploadWorkers);

    for (const { selection, index, objectKey } of uploadPlans) {
      fileStates[index].status = "finalizing";
      emitProgress("finalizing", index + 1, selection.fileName, true);

      await registerUploadedDemoHostedFile({
        contentId: params.contentId,
        fileName: sanitizeUploadFileName(selection.fileName),
        objectKey,
        mimeType: selection.mimeType || "application/octet-stream",
        byteSize: selection.byteSize || 0,
        uploadedByUserId: params.actorUserId
      });

      fileStates[index].status = "done";
      emitProgress("finalizing", index + 1, selection.fileName, true);
    }

    await recordSiteDownloadDemoUploadSuccess({
      contentId: params.contentId,
      telegramSourceUrl: params.telegramSourceUrl,
      selections: params.selections
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload Telegram media to R2";
    await recordSiteDownloadDemoUploadFailure({
      contentId: params.contentId,
      telegramSourceUrl: params.telegramSourceUrl,
      selections: params.selections,
      errorMessage: message
    });
    throw error;
  }
}

export async function completeSiteDownloadDemo(params: {
  contentId: number;
  actorUserId: number;
}) {
  await syncSiteDownloadDemoHostedFilesFromR2({
    contentId: params.contentId,
    actorUserId: params.actorUserId
  });

  const hostedFileCount = await db.contentFile.count({
    where: {
      contentId: params.contentId
    }
  });

  if (!hostedFileCount) {
    throw new Error("No hosted files were found for this content yet");
  }

  await db.contentSiteDownloadDemo.upsert({
    where: {
      contentId: params.contentId
    },
    update: {
      status: SiteDownloadDemoStatus.UPLOADED,
      errorMessage: null,
      completedByUserId: params.actorUserId,
      completedAt: new Date()
    },
    create: {
      contentId: params.contentId,
      status: SiteDownloadDemoStatus.UPLOADED,
      completedByUserId: params.actorUserId,
      completedAt: new Date()
    }
  });
}
