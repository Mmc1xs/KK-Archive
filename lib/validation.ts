import { ReviewStatus, TagType } from "@prisma/client";
import { z } from "zod";

const contentImageUrlSchema = z.string().url("Invalid image URL");
const internalDownloadPathPattern = /^\/api\/downloads\/content-file\/\d+$/;
const RESERVED_USERNAMES = new Set([
  "admin",
  "audit",
  "support",
  "official",
  "system",
  "root",
  "member",
  "profile",
  "login",
  "register"
]);

function isAllowedExternalUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "https:") {
      return true;
    }

    const isLocalDevHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (process.env.NODE_ENV !== "production" && parsed.protocol === "http:" && isLocalDevHost) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function normalizeUsername(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

const optionalUrlSchema = z.preprocess((value) => {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : undefined;
}, z.string().url("Invalid source URL").refine(isAllowedExternalUrl, "Source URL must use https (localhost http is allowed in development)").optional());

const downloadLinkSchema = z
  .string()
  .trim()
  .min(1, "Invalid download URL")
  .refine((value) => {
    if (internalDownloadPathPattern.test(value)) {
      return true;
    }
    return isAllowedExternalUrl(value);
  }, "Invalid download URL");

export const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

export const loginSchema = registerSchema;

export const usernameSchema = z.preprocess(
  normalizeUsername,
  z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(24, "Username must be at most 24 characters")
    .regex(/^[a-z0-9_]+$/, "Username may only contain lowercase letters, numbers, and underscores")
    .refine((value: string) => !RESERVED_USERNAMES.has(value), "This username is reserved")
);

export const tagSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens"),
  type: z.nativeEnum(TagType)
});

export const updateTagSchema = z.object({
  tagId: z.coerce.number().int().positive("Invalid tag id"),
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens")
});

export const contentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens"),
  description: z.string().min(1, "Description is required"),
  coverImageUrl: contentImageUrlSchema,
  sourceLink: optionalUrlSchema,
  reviewStatus: z.nativeEnum(ReviewStatus).default(ReviewStatus.UNVERIFIED),
  publishStatus: z.enum(["DRAFT", "SUMMIT", "PUBLISHED", "INVISIBLE"]),
  authorTagIds: z.array(z.coerce.number().int().positive()).default([]),
  authorTagNames: z.array(z.string().trim().min(1)).max(1, "Exactly one author is required").default([]),
  workTagIds: z.array(z.coerce.number().int().positive()).default([]),
  workTagNames: z.array(z.string().trim().min(1)).max(1, "Exactly one work is required").default([]),
  characterTagIds: z.array(z.coerce.number().int().positive()).default([]),
  characterTagNames: z.array(z.string().trim().min(1)).max(1, "Exactly one character is required").default([]),
  styleTagIds: z.array(z.coerce.number().int().positive()).default([]),
  styleTagNames: z.array(z.string().trim().min(1)).default([]),
  usageTagIds: z.array(z.coerce.number().int().positive()).default([]),
  usageTagNames: z.array(z.string().trim().min(1)).default([]),
  typeTagIds: z.array(z.coerce.number().int().positive()).length(1, "Type is required"),
  downloadLinks: z.array(downloadLinkSchema).default([]),
  imageUrls: z.array(contentImageUrlSchema).min(1, "At least one image is required")
});

export function normalizeTagType(type: string) {
  switch (type) {
    case "author":
      return TagType.AUTHOR;
    case "work":
      return TagType.WORK;
    case "character":
      return TagType.CHARACTER;
    case "style":
      return TagType.STYLE;
    case "usage":
      return TagType.USAGE;
    case "type":
      return TagType.TYPE;
    default:
      return null;
  }
}
