import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
  type PutObjectCommandInput
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

declare global {
  var r2ClientSingleton: S3Client | undefined;
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getR2Config() {
  const accountId = requireEnv("R2_ACCOUNT_ID");
  const bucketName = requireEnv("R2_BUCKET_NAME");
  const publicBaseUrl = requireEnv("R2_PUBLIC_BASE_URL");

  return {
    accountId,
    bucketName,
    publicBaseUrl: publicBaseUrl.replace(/\/+$/, "")
  };
}

export function createR2Client() {
  if (global.r2ClientSingleton) {
    return global.r2ClientSingleton;
  }

  const { accountId } = getR2Config();

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY")
    }
  });

  global.r2ClientSingleton = client;
  return client;
}

export function buildR2PublicUrl(key: string) {
  const { publicBaseUrl } = getR2Config();
  return `${publicBaseUrl}/${key}`;
}

export async function createR2MultipartUpload(params: {
  key: string;
  contentType: string;
}) {
  const client = createR2Client();
  const { bucketName } = getR2Config();

  const result = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: bucketName,
      Key: params.key,
      ContentType: params.contentType,
      CacheControl: "public, max-age=31536000, immutable"
    })
  );

  if (!result.UploadId) {
    throw new Error("Failed to create multipart upload");
  }

  return result.UploadId;
}

export async function createR2SingleUploadUrl(params: {
  key: string;
  contentType: string;
}) {
  const client = createR2Client();
  const { bucketName } = getR2Config();

  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucketName,
      Key: params.key,
      ContentType: params.contentType,
      CacheControl: "public, max-age=31536000, immutable"
    }),
    { expiresIn: 60 * 15 }
  );
}

export async function uploadR2Object(params: {
  key: string;
  body: PutObjectCommandInput["Body"];
  contentType: string;
  contentLength?: number;
}) {
  const client = createR2Client();
  const { bucketName } = getR2Config();

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      ...(typeof params.contentLength === "number" && params.contentLength > 0
        ? { ContentLength: params.contentLength }
        : {}),
      CacheControl: "public, max-age=31536000, immutable"
    })
  );
}

export async function createR2MultipartPartUploadUrl(params: {
  key: string;
  uploadId: string;
  partNumber: number;
}) {
  const client = createR2Client();
  const { bucketName } = getR2Config();

  return getSignedUrl(
    client,
    new UploadPartCommand({
      Bucket: bucketName,
      Key: params.key,
      UploadId: params.uploadId,
      PartNumber: params.partNumber
    }),
    { expiresIn: 60 * 15 }
  );
}

export async function completeR2MultipartUpload(params: {
  key: string;
  uploadId: string;
  parts: Array<{ ETag: string; PartNumber: number }>;
}) {
  const client = createR2Client();
  const { bucketName } = getR2Config();

  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucketName,
      Key: params.key,
      UploadId: params.uploadId,
      MultipartUpload: {
        Parts: params.parts
      }
    })
  );
}

export async function abortR2MultipartUpload(params: {
  key: string;
  uploadId: string;
}) {
  const client = createR2Client();
  const { bucketName } = getR2Config();

  await client.send(
    new AbortMultipartUploadCommand({
      Bucket: bucketName,
      Key: params.key,
      UploadId: params.uploadId
    })
  );
}

function sanitizeDispositionFileName(fileName: string) {
  return fileName.replace(/["\\\r\n]/g, "_");
}

export async function createR2DownloadUrl(params: {
  key: string;
  fileName?: string;
  expiresInSeconds?: number;
}) {
  const client = createR2Client();
  const { bucketName } = getR2Config();
  const expiresIn = params.expiresInSeconds ?? 60 * 5;

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucketName,
      Key: params.key,
      ...(params.fileName
        ? {
            ResponseContentDisposition: `attachment; filename="${sanitizeDispositionFileName(params.fileName)}"`
          }
        : {})
    }),
    { expiresIn }
  );
}

export async function listR2ObjectsByPrefix(prefix: string) {
  const client = createR2Client();
  const { bucketName } = getR2Config();
  const objects: Array<{ key: string; size: number; lastModified: Date | null }> = [];
  let continuationToken: string | undefined;

  do {
    const result = await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken
      })
    );

    for (const item of result.Contents ?? []) {
      if (!item.Key) {
        continue;
      }

      objects.push({
        key: item.Key,
        size: Number(item.Size ?? 0),
        lastModified: item.LastModified ?? null
      });
    }

    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (continuationToken);

  return objects;
}
