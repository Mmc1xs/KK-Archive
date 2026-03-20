import { NextResponse } from "next/server";
import { TagType } from "@prisma/client";
import { searchTagsByType } from "@/lib/tag";

export const preferredRegion = "hkg1";

const ALLOWED_TYPES = new Set<TagType>([TagType.AUTHOR, TagType.WORK, TagType.CHARACTER, TagType.STYLE, TagType.USAGE]);

function parseType(rawType: string | null) {
  if (!rawType) {
    return null;
  }

  if (!Object.values(TagType).includes(rawType as TagType)) {
    return null;
  }

  const type = rawType as TagType;
  if (!ALLOWED_TYPES.has(type)) {
    return null;
  }

  return type;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = parseType(searchParams.get("type"));

  if (!type) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const query = searchParams.get("q") ?? "";
  const limit = Number(searchParams.get("limit") ?? "12");
  const excludeSlugs = searchParams.getAll("exclude");
  const workIdRaw = searchParams.get("workId");
  const workId = workIdRaw ? Number(workIdRaw) : undefined;

  if (type === TagType.CHARACTER && (!workId || !Number.isInteger(workId) || workId <= 0)) {
    return NextResponse.json({ items: [] });
  }

  const tags = await searchTagsByType({
    type,
    query,
    limit: Number.isFinite(limit) ? limit : 12,
    excludeSlugs,
    workTagId: type === TagType.CHARACTER ? workId : undefined
  });

  return NextResponse.json(
    {
      items: tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug
      }))
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600"
      }
    }
  );
}
