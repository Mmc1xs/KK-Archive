import { S3Client } from "@aws-sdk/client-s3";

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
  const { accountId } = getR2Config();

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY")
    }
  });
}

export function buildR2PublicUrl(key: string) {
  const { publicBaseUrl } = getR2Config();
  return `${publicBaseUrl}/${key}`;
}
