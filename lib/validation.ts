import { ReviewStatus, TagType } from "@prisma/client";
import { z } from "zod";

const contentImageUrlSchema = z.string().url("Invalid image URL");

export const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

export const loginSchema = registerSchema;

export const tagSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens"),
  type: z.nativeEnum(TagType)
});

export const contentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens"),
  description: z.string().min(1, "Description is required"),
  coverImageUrl: contentImageUrlSchema,
  reviewStatus: z.nativeEnum(ReviewStatus).default(ReviewStatus.UNVERIFIED),
  publishStatus: z.enum(["DRAFT", "SUMMIT", "PUBLISHED"]),
  authorTagIds: z.array(z.coerce.number().int().positive()).default([]),
  authorTagNames: z.array(z.string().trim().min(1)).default([]),
  styleTagIds: z.array(z.coerce.number().int().positive()).default([]),
  styleTagNames: z.array(z.string().trim().min(1)).default([]),
  usageTagIds: z.array(z.coerce.number().int().positive()).default([]),
  usageTagNames: z.array(z.string().trim().min(1)).default([]),
  typeTagIds: z.array(z.coerce.number().int().positive()).length(1, "Type is required"),
  downloadLinks: z.array(z.string().url("Invalid download URL")).default([]),
  imageUrls: z.array(contentImageUrlSchema).min(1, "At least one image is required")
});

export function normalizeTagType(type: string) {
  switch (type) {
    case "author":
      return TagType.AUTHOR;
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
