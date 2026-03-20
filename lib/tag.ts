import { TagType } from "@prisma/client";
import { revalidateTag, unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { tagSchema, updateTagSchema } from "@/lib/validation";

const FIXED_TYPE_TAGS = [
  { name: "Character card", slug: "type-character-card" },
  { name: "Cloth card", slug: "type-cloth-card" },
  { name: "Scene Card", slug: "type-scene-card" },
  { name: "Overlay", slug: "type-overlay" },
  { name: "Texture", slug: "type-texture" }
] as const;

export async function ensureFixedTypeTags() {
  await db.tag.createMany({
    data: FIXED_TYPE_TAGS.map((tag) => ({
      name: tag.name,
      slug: tag.slug,
      type: TagType.TYPE
    })),
    skipDuplicates: true
  });
}

export async function getAllTags() {
  return getCachedAllTags();
}

export async function getAdminTagsPage(options?: { page?: number; pageSize?: number }) {
  await ensureFixedTypeTags();

  const page = Number.isInteger(options?.page) && (options?.page ?? 0) > 0 ? (options?.page as number) : 1;
  const pageSize =
    Number.isInteger(options?.pageSize) && (options?.pageSize ?? 0) > 0 ? (options?.pageSize as number) : 50;

  const [totalCount, items] = await Promise.all([
    db.tag.count(),
    db.tag.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  return {
    items,
    totalCount,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize))
  };
}

export async function getTagOptions() {
  return getCachedTagOptions();
}

export async function getTagTypeOptions() {
  return getCachedTypeTags();
}

export async function getTagById(tagId: number) {
  return db.tag.findUnique({
    where: { id: tagId }
  });
}

const getCachedAllTags = unstable_cache(
  async () => {
    await ensureFixedTypeTags();
    return db.tag.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }]
    });
  },
  ["admin-all-tags"],
  {
    revalidate: 300,
    tags: ["tags"]
  }
);

const getCachedTagOptions = unstable_cache(
  async () => {
    const tags = await getCachedAllTags();
    return {
      authors: tags.filter((tag) => tag.type === TagType.AUTHOR),
      styles: tags.filter((tag) => tag.type === TagType.STYLE),
      usages: tags.filter((tag) => tag.type === TagType.USAGE),
      types: tags.filter((tag) => tag.type === TagType.TYPE)
    };
  },
  ["admin-tag-options"],
  {
    revalidate: 300,
    tags: ["tags"]
  }
);

const getCachedTypeTags = unstable_cache(
  async () => {
    await ensureFixedTypeTags();
    return db.tag.findMany({
      where: {
        type: TagType.TYPE
      },
      orderBy: [{ name: "asc" }]
    });
  },
  ["tag-type-options"],
  {
    revalidate: 300,
    tags: ["tags"]
  }
);

type SearchTagsByTypeOptions = {
  type: TagType;
  query?: string;
  limit?: number;
  excludeSlugs?: string[];
};

export async function searchTagsByType(options: SearchTagsByTypeOptions) {
  const normalizedQuery = options.query?.trim() ?? "";
  const limit = Math.min(Math.max(options.limit ?? 12, 1), 30);
  const excludeSlugs = [...new Set((options.excludeSlugs ?? []).map((slug) => slug.trim()).filter(Boolean))];

  return db.tag.findMany({
    where: {
      type: options.type,
      ...(normalizedQuery
        ? {
            OR: [
              {
                name: {
                  contains: normalizedQuery,
                  mode: "insensitive"
                }
              },
              {
                slug: {
                  contains: normalizedQuery,
                  mode: "insensitive"
                }
              }
            ]
          }
        : {}),
      ...(excludeSlugs.length
        ? {
            slug: {
              notIn: excludeSlugs
            }
          }
        : {})
    },
    orderBy: [{ name: "asc" }],
    take: limit
  });
}

export async function saveTag(input: unknown) {
  const parsed = tagSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? "Invalid tag data" };
  }

  if (parsed.data.type === TagType.TYPE) {
    return { ok: false as const, error: "Type tags are fixed and cannot be created manually." };
  }

  if (parsed.data.type !== TagType.AUTHOR) {
    const existingTag = await db.tag.findFirst({
      where: {
        name: parsed.data.name,
        type: parsed.data.type
      }
    });

    if (existingTag) {
      return { ok: false as const, error: "Style and usage tag names must stay unique." };
    }
  }

  try {
    await db.tag.create({
      data: parsed.data
    });
    revalidateTag("tags", "max");
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Failed to create tag. Slug or name may already exist." };
  }
}

export async function updateTag(input: unknown) {
  const parsed = updateTagSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? "Invalid tag data" };
  }

  const existingTag = await db.tag.findUnique({
    where: { id: parsed.data.tagId }
  });

  if (!existingTag) {
    return { ok: false as const, error: "Tag not found." };
  }

  if (existingTag.type === TagType.TYPE) {
    return { ok: false as const, error: "Type tags are fixed and cannot be edited." };
  }

  if (existingTag.type !== TagType.AUTHOR) {
    const duplicateName = await db.tag.findFirst({
      where: {
        id: { not: existingTag.id },
        type: existingTag.type,
        name: parsed.data.name
      }
    });
    if (duplicateName) {
      return { ok: false as const, error: "Style and usage tag names must stay unique." };
    }
  }

  try {
    await db.tag.update({
      where: { id: existingTag.id },
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug
      }
    });
    revalidateTag("tags", "max");
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Failed to update tag. Slug may already exist." };
  }
}

export async function deleteTag(tagId: number) {
  if (!Number.isInteger(tagId) || tagId <= 0) {
    return { ok: false as const, error: "Invalid tag id" };
  }

  const tag = await db.tag.findUnique({
    where: { id: tagId },
    select: {
      id: true,
      type: true
    }
  });

  if (!tag) {
    return { ok: false as const, error: "Tag not found." };
  }

  if (tag.type === TagType.TYPE) {
    return { ok: false as const, error: "Type tags are fixed and cannot be deleted." };
  }

  const usedCount = await db.contentTag.count({
    where: {
      tagId: tag.id
    }
  });

  if (usedCount > 0) {
    return { ok: false as const, error: "Tag is currently used by contents and cannot be deleted." };
  }

  await db.tag.delete({
    where: { id: tag.id }
  });

  revalidateTag("tags", "max");
  return { ok: true as const };
}

export function getFixedTypeTagNames() {
  return FIXED_TYPE_TAGS.map((tag) => tag.name);
}
