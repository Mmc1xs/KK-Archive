import { TagType } from "@prisma/client";
import { db } from "@/lib/db";
import { tagSchema } from "@/lib/validation";

const FIXED_TYPE_TAGS = [
  { name: "Character card", slug: "type-character-card" },
  { name: "Cloth card", slug: "type-cloth-card" },
  { name: "Scene Card", slug: "type-scene-card" },
  { name: "Overlay", slug: "type-overlay" },
  { name: "Texture", slug: "type-texture" }
] as const;

export async function ensureFixedTypeTags() {
  await Promise.all(
    FIXED_TYPE_TAGS.map((tag) =>
      db.tag.upsert({
        where: { slug: tag.slug },
        update: {
          name: tag.name,
          type: TagType.TYPE
        },
        create: {
          name: tag.name,
          slug: tag.slug,
          type: TagType.TYPE
        }
      })
    )
  );
}

export async function getAllTags() {
  await ensureFixedTypeTags();
  return db.tag.findMany({
    orderBy: [{ type: "asc" }, { name: "asc" }]
  });
}

export async function getTagOptions() {
  const tags = await getAllTags();
  return {
    authors: tags.filter((tag) => tag.type === TagType.AUTHOR),
    styles: tags.filter((tag) => tag.type === TagType.STYLE),
    usages: tags.filter((tag) => tag.type === TagType.USAGE),
    types: tags.filter((tag) => tag.type === TagType.TYPE)
  };
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
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Failed to create tag. Slug or name may already exist." };
  }
}

export function getFixedTypeTagNames() {
  return FIXED_TYPE_TAGS.map((tag) => tag.name);
}
