import { PublishStatus, ReviewStatus, TagType } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { contentSchema } from "@/lib/validation";

function slugifyTagName(name: string) {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || "tag";
}

async function generateUniqueTagSlug(name: string, type: TagType) {
  const baseSlug = `${type.toLowerCase()}-${slugifyTagName(name)}`;
  let slug = baseSlug;
  let counter = 2;

  while (await db.tag.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return slug;
}

async function resolveTagIds(type: TagType, existingIds: number[], newNames: string[]) {
  const ids = [...existingIds];
  const normalizedNewNames = [...new Set(newNames.map((name) => name.trim()).filter(Boolean))];

  for (const newName of normalizedNewNames) {
    const existingByName =
      type === TagType.AUTHOR
        ? null
        : await db.tag.findFirst({
            where: {
              type,
              name: newName
            }
          });

    if (existingByName) {
      ids.push(existingByName.id);
      continue;
    }

    const createdTag = await db.tag.create({
      data: {
        name: newName,
        slug: await generateUniqueTagSlug(newName, type),
        type
      }
    });

    ids.push(createdTag.id);
  }

  return [...new Set(ids)];
}

function getVisibleStatuses(isLoggedIn: boolean) {
  return isLoggedIn ? [PublishStatus.PUBLISHED, PublishStatus.SUMMIT] : [PublishStatus.PUBLISHED];
}

const getCachedHomepageContents = unstable_cache(
  async () =>
    db.content.findMany({
      where: { publishStatus: PublishStatus.PUBLISHED },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        contentTags: {
          include: {
            tag: true
          }
        }
      }
    }),
  ["homepage-contents"],
  { revalidate: 300 }
);

export async function getHomepageContents() {
  return getCachedHomepageContents();
}

const getCachedHomepageOverviewStats = unstable_cache(
  async () => {
    const totalPosts = await db.content.count({
      where: {
        publishStatus: PublishStatus.PUBLISHED
      }
    });
    const indexedAuthors = await db.tag.count({
      where: {
        type: TagType.AUTHOR
      }
    });
    const fileTypes = await db.tag.count({
      where: {
        type: TagType.TYPE
      }
    });
    const styleTags = await db.tag.count({
      where: {
        type: TagType.STYLE
      }
    });
    const usageTags = await db.tag.count({
      where: {
        type: TagType.USAGE
      }
    });

    return {
      totalPosts,
      indexedAuthors,
      fileTypes,
      styleTags,
      usageTags
    };
  },
  ["homepage-overview-stats"],
  { revalidate: 300 }
);

export async function getHomepageOverviewStats() {
  return getCachedHomepageOverviewStats();
}

export async function recordContentView(contentId: number) {
  await db.content.update({
    where: { id: contentId },
    data: {
      viewCount: {
        increment: 1
      },
      lastViewedAt: new Date()
    }
  });
}

export async function getContentViewAnalytics() {
  const totalViews = await db.content.aggregate({
    _sum: {
      viewCount: true
    }
  });
  const viewedContents = await db.content.count({
    where: {
      viewCount: {
        gt: 0
      }
    }
  });
  const topViewedContents = await db.content.findMany({
    orderBy: [{ viewCount: "desc" }, { lastViewedAt: "desc" }],
    take: 6,
    select: {
      id: true,
      title: true,
      slug: true,
      publishStatus: true,
      viewCount: true,
      lastViewedAt: true
    }
  });

  return {
    totalViews: totalViews._sum.viewCount ?? 0,
    viewedContents,
    topViewedContents
  };
}

export async function getBrowsableContents(isLoggedIn: boolean) {
  return db.content.findMany({
    where: {
      publishStatus: {
        in: getVisibleStatuses(isLoggedIn)
      }
    },
    orderBy: { createdAt: "desc" },
    include: {
      contentTags: {
        include: { tag: true }
      }
    }
  });
}

export async function getBrowsableContentsPage(isLoggedIn: boolean, page: number, pageSize: number) {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 12;

  if (!isLoggedIn) {
    return getCachedPublicBrowsableContentsPage(safePage, safePageSize);
  }

  const where = {
    publishStatus: {
      in: getVisibleStatuses(isLoggedIn)
    }
  };

  const totalCount = await db.content.count({ where });
  const items = await db.content.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (safePage - 1) * safePageSize,
    take: safePageSize,
    include: {
      contentTags: {
        include: { tag: true }
      }
    }
  });

  return {
    items,
    totalCount,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / safePageSize))
  };
}

const getCachedPublicBrowsableContentsPage = unstable_cache(
  async (safePage: number, safePageSize: number) => {
    const where = {
      publishStatus: {
        in: [PublishStatus.PUBLISHED]
      }
    };

    const totalCount = await db.content.count({ where });
    const items = await db.content.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
      include: {
        contentTags: {
          include: { tag: true }
        }
      }
    });

    return {
      items,
      totalCount,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / safePageSize))
    };
  },
  ["public-browsable-contents-page"],
  { revalidate: 120 }
);

export async function getBrowsableContentBySlug(slug: string, isLoggedIn: boolean) {
  return db.content.findFirst({
    where: {
      slug,
      publishStatus: {
        in: getVisibleStatuses(isLoggedIn)
      }
    },
    include: {
      images: {
        orderBy: { sortOrder: "asc" }
      },
      downloadLinks: {
        orderBy: { sortOrder: "asc" }
      },
      contentTags: {
        include: {
          tag: true
        }
      }
    }
  });
}

export async function getSearchFilters() {
  const tags = await getCachedSearchFilters();

  return {
    authors: tags.filter((tag) => tag.type === TagType.AUTHOR),
    styles: tags.filter((tag) => tag.type === TagType.STYLE),
    usages: tags.filter((tag) => tag.type === TagType.USAGE),
    types: tags.filter((tag) => tag.type === TagType.TYPE)
  };
}

const getCachedSearchFilters = unstable_cache(
  async () =>
    db.tag.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }]
    }),
  ["search-filters"],
  { revalidate: 300 }
);

const getCachedPublicSearchResults = unstable_cache(
  async (author?: string, styles?: string[], usages?: string[], types?: string[]) => {
    const styleSlugs = styles?.filter(Boolean) ?? [];
    const usageSlugs = usages?.filter(Boolean) ?? [];
    const typeSlugs = types?.filter(Boolean) ?? [];
    const andConditions = [
      ...styleSlugs.map((slug) => ({
        contentTags: {
          some: {
            tag: {
              slug,
              type: TagType.STYLE
            }
          }
        }
      })),
      ...usageSlugs.map((slug) => ({
        contentTags: {
          some: {
            tag: {
              slug,
              type: TagType.USAGE
            }
          }
        }
      })),
      ...typeSlugs.map((slug) => ({
        contentTags: {
          some: {
            tag: {
              slug,
              type: TagType.TYPE
            }
          }
        }
      }))
    ];

    return db.content.findMany({
      where: {
        publishStatus: {
          in: [PublishStatus.PUBLISHED]
        },
        ...(author
          ? {
              contentTags: {
                some: {
                  tag: {
                    slug: author,
                    type: TagType.AUTHOR
                  }
                }
              }
            }
          : {}),
        ...(andConditions.length
          ? {
              AND: andConditions
            }
          : {})
      },
      orderBy: { createdAt: "desc" },
      include: {
        contentTags: {
          include: { tag: true }
        }
      }
    });
  },
  ["public-search-results"],
  { revalidate: 120 }
);

export async function searchPublishedContents(filters: {
  isLoggedIn: boolean;
  author?: string;
  styles?: string[];
  usages?: string[];
  types?: string[];
}) {
  if (!filters.isLoggedIn) {
    return getCachedPublicSearchResults(filters.author, filters.styles, filters.usages, filters.types);
  }

  const styleSlugs = filters.styles?.filter(Boolean) ?? [];
  const usageSlugs = filters.usages?.filter(Boolean) ?? [];
  const typeSlugs = filters.types?.filter(Boolean) ?? [];
  const andConditions = [
    ...styleSlugs.map((slug) => ({
      contentTags: {
        some: {
          tag: {
            slug,
            type: TagType.STYLE
          }
        }
      }
    })),
    ...usageSlugs.map((slug) => ({
      contentTags: {
        some: {
          tag: {
            slug,
            type: TagType.USAGE
          }
        }
      }
    })),
    ...typeSlugs.map((slug) => ({
      contentTags: {
        some: {
          tag: {
            slug,
            type: TagType.TYPE
          }
        }
      }
    }))
  ];

  return db.content.findMany({
    where: {
      publishStatus: {
        in: getVisibleStatuses(filters.isLoggedIn)
      },
      ...(filters.author
        ? {
            contentTags: {
              some: {
                tag: {
                  slug: filters.author,
                  type: TagType.AUTHOR
                }
              }
            }
          }
        : {}),
      ...(andConditions.length
        ? {
            AND: andConditions
          }
        : {})
    },
    orderBy: { createdAt: "desc" },
    include: {
      contentTags: {
        include: { tag: true }
      }
    }
  });
}

export async function getAdminContents(filter?: { reviewStatus?: "all" | "unverified" | "edited" | "passed" }) {
  return db.content.findMany({
    where: {
      ...(filter?.reviewStatus === "unverified"
        ? { reviewStatus: ReviewStatus.UNVERIFIED }
        : filter?.reviewStatus === "edited"
          ? { reviewStatus: ReviewStatus.EDITED }
          : filter?.reviewStatus === "passed"
            ? { reviewStatus: ReviewStatus.PASSED }
            : {})
    },
    orderBy: { updatedAt: "desc" },
    include: {
      contentTags: {
        include: { tag: true }
      }
    }
  });
}

export async function getAdminContentReviewCounts() {
  const unverified = await db.content.count({
    where: {
      reviewStatus: ReviewStatus.UNVERIFIED
    }
  });
  const edited = await db.content.count({
    where: {
      reviewStatus: ReviewStatus.EDITED
    }
  });
  const passed = await db.content.count({
    where: {
      reviewStatus: ReviewStatus.PASSED
    }
  });

  return {
    unverified,
    edited,
    passed
  };
}

export async function getAdminContentById(id: number) {
  return db.content.findUnique({
    where: { id },
    include: {
      images: {
        orderBy: { sortOrder: "asc" }
      },
      downloadLinks: {
        orderBy: { sortOrder: "asc" }
      },
      contentTags: {
        include: {
          tag: true
        }
      }
    }
  });
}

export async function saveContent(input: unknown, contentId?: number, options?: { reviewStatusOverride?: ReviewStatus }) {
  const parsed = contentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.errors[0]?.message ?? "Validation failed"
    };
  }

  const data = parsed.data;
  const authorSelections = data.authorTagIds.length + data.authorTagNames.length;
  if (authorSelections !== 1) {
    return { ok: false as const, error: "Exactly one author is required" };
  }

  const authorTagIds = await resolveTagIds(TagType.AUTHOR, data.authorTagIds, data.authorTagNames);

  const authorTags = authorTagIds.length
    ? await db.tag.findMany({
        where: {
          id: { in: authorTagIds },
          type: TagType.AUTHOR
        }
      })
    : [];
  if (authorTags.length !== authorTagIds.length) {
    return { ok: false as const, error: "Author tag not found" };
  }

  const styleTagIds = await resolveTagIds(TagType.STYLE, data.styleTagIds, data.styleTagNames);
  const usageTagIds = await resolveTagIds(TagType.USAGE, data.usageTagIds, data.usageTagNames);
  const typeTags = data.typeTagIds.length
    ? await db.tag.findMany({
        where: {
          id: { in: data.typeTagIds },
          type: TagType.TYPE
        }
      })
    : [];

  const styleTags = styleTagIds.length
    ? await db.tag.findMany({
        where: {
          id: { in: styleTagIds },
          type: TagType.STYLE
        }
      })
    : [];
  const usageTags = usageTagIds.length
    ? await db.tag.findMany({
        where: {
          id: { in: usageTagIds },
          type: TagType.USAGE
        }
      })
    : [];

  if (styleTags.length !== styleTagIds.length || usageTags.length !== usageTagIds.length) {
    return { ok: false as const, error: "Invalid tag type selection" };
  }
  if (typeTags.length !== data.typeTagIds.length) {
    return { ok: false as const, error: "Invalid content type selection" };
  }
  if (data.typeTagIds.length !== 1) {
    return { ok: false as const, error: "Exactly one type is required" };
  }

  const tagIds = [...authorTagIds, ...styleTagIds, ...usageTagIds, ...data.typeTagIds];

  try {
    const content = await db.content.upsert({
      where: { id: contentId ?? -1 },
      update: {
        title: data.title,
        slug: data.slug,
        description: data.description,
        coverImageUrl: data.coverImageUrl,
        sourceLink: data.sourceLink ?? null,
        isVerified: (options?.reviewStatusOverride ?? data.reviewStatus) === ReviewStatus.PASSED,
        reviewStatus: options?.reviewStatusOverride ?? data.reviewStatus,
        publishStatus: data.publishStatus,
        contentTags: {
          deleteMany: {},
          create: tagIds.map((tagId) => ({
            tagId
          }))
        },
        images: {
          deleteMany: {},
          create: data.imageUrls.map((imageUrl, index) => ({
            imageUrl,
            sortOrder: index
          }))
        },
        downloadLinks: {
          deleteMany: {},
          create: data.downloadLinks.map((url, index) => ({
            url,
            sortOrder: index
          }))
        }
      },
      create: {
        title: data.title,
        slug: data.slug,
        description: data.description,
        coverImageUrl: data.coverImageUrl,
        sourceLink: data.sourceLink ?? null,
        isVerified: (options?.reviewStatusOverride ?? data.reviewStatus) === ReviewStatus.PASSED,
        reviewStatus: options?.reviewStatusOverride ?? data.reviewStatus,
        publishStatus: data.publishStatus,
        contentTags: {
          create: tagIds.map((tagId) => ({
            tagId
          }))
        },
        images: {
          create: data.imageUrls.map((imageUrl, index) => ({
            imageUrl,
            sortOrder: index
          }))
        },
        downloadLinks: {
          create: data.downloadLinks.map((url, index) => ({
            url,
            sortOrder: index
          }))
        }
      }
    });

    const authorCount = await db.contentTag.count({
      where: {
        contentId: content.id,
        tag: {
          type: TagType.AUTHOR
        }
      }
    });

    if (authorCount !== 1) {
      throw new Error("Each content item must have exactly one author tag.");
    }

    return { ok: true as const, contentId: content.id };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return { ok: false as const, error: "Slug already exists" };
    }
    return { ok: false as const, error: "Failed to save content" };
  }
}
