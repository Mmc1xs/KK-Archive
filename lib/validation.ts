import { ReviewStatus, TagType } from "@prisma/client";
import { z } from "zod";

const contentImageUrlSchema = z.string().url("Invalid image URL");
const internalDownloadPathPattern =
  /^\/api\/downloads\/content-file\/(?:\d+|token\/[A-Za-z0-9_-]+\.[A-Fa-f0-9]+)$/;
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
    .regex(/^[A-Za-z0-9-#]+$/, "Slug may only contain letters, numbers, hyphens, and #"),
  description: z.preprocess((value) => String(value ?? "").trim(), z.string()),
  coverImageUrl: contentImageUrlSchema,
  sourceLink: optionalUrlSchema,
  reviewStatus: z.nativeEnum(ReviewStatus).default(ReviewStatus.UNVERIFIED),
  publishStatus: z.enum(["DRAFT", "SUMMIT", "PUBLISHED", "COMPLIANCE_REJECTED", "INVISIBLE"]),
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

const HOMEPAGE_BULLETIN_LOCALES = ["en", "zh-CN", "ja"] as const;

function normalizeOptionalDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return undefined;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date;
}

export const homepageBulletinSchema = z
  .object({
    locale: z.enum(HOMEPAGE_BULLETIN_LOCALES),
    title: z.string().trim().min(1, "Title is required").max(120, "Title must be at most 120 characters"),
    summary: z.string().trim().max(280, "Summary must be at most 280 characters").default(""),
    linkUrl: z.preprocess(
      (value) => {
        const normalized = String(value ?? "").trim();
        return normalized ? normalized : undefined;
      },
      z
        .string()
        .url("Link must be a valid URL")
        .refine(
          (value) => isAllowedExternalUrl(value),
          "Link must use https (localhost http is allowed in development)"
        )
        .optional()
    ),
    publishedAt: z.preprocess(
      normalizeOptionalDate,
      z.date({ invalid_type_error: "Published time is invalid" }).optional()
    ),
    startsAt: z.preprocess(
      normalizeOptionalDate,
      z.date({ invalid_type_error: "Start time is invalid" }).optional()
    ),
    endsAt: z.preprocess(
      normalizeOptionalDate,
      z.date({ invalid_type_error: "End time is invalid" }).optional()
    ),
    isActive: z.coerce.boolean().default(true),
    isPinned: z.coerce.boolean().default(false),
    sortOrder: z.coerce.number().int("Sort order must be an integer").min(0).max(9999).default(0)
  })
  .refine(
    (data) => {
      if (!data.startsAt || !data.endsAt) {
        return true;
      }

      return data.endsAt.getTime() >= data.startsAt.getTime();
    },
    {
      message: "End time must be after start time",
      path: ["endsAt"]
    }
  );

export const modLibraryEntrySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255, "Name must be at most 255 characters"),
  version: z.string().trim().max(120, "Version must be at most 120 characters").default(""),
  author: z.string().trim().max(255, "Author must be at most 255 characters").default(""),
  guid: z.string().trim().min(1, "Guid is required").max(255, "Guid must be at most 255 characters"),
  filename: z.string().trim().min(1, "Filename is required").max(400, "Filename must be at most 400 characters"),
  messageLink: z
    .string()
    .trim()
    .max(1200, "Message link must be at most 1200 characters")
    .default("")
    .refine(
      (value) => value.length === 0 || isAllowedExternalUrl(value),
      "Message link must use https (localhost http is allowed in development)"
    )
});

export const modLibraryBindingSchema = z.object({
  modId: z.coerce.number().int().positive("Invalid mod id"),
  contentId: z.coerce.number().int().positive("Invalid content id"),
  note: z.string().trim().max(200, "Note must be at most 200 characters").default("")
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
