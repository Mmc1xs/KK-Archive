import { Prisma, PublishStatus, ReviewStatus, TagType } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { buildContentFileDownloadPath, buildLegacyContentFileDownloadPath } from "@/lib/downloads/content-file-token";
import { buildR2PublicUrl } from "@/lib/storage/r2";
import { contentSchema } from "@/lib/validation";
import { revalidateTag } from "next/cache";

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
      where: {
        publishStatus: PublishStatus.PUBLISHED
      },
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
    const [totalPosts, indexedAuthors, fileTypes, styleTags, usageTags] = await Promise.all([
      db.content.count({
        where: {
          publishStatus: PublishStatus.PUBLISHED
        }
      }),
      db.tag.count({
        where: {
          type: TagType.AUTHOR
        }
      }),
      db.tag.count({
        where: {
          type: TagType.TYPE
        }
      }),
      db.tag.count({
        where: {
          type: TagType.STYLE
        }
      }),
      db.tag.count({
        where: {
          type: TagType.USAGE
        }
      })
    ]);

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
      hostedFiles: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          fileName: true,
          objectKey: true
        }
      },
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

type SearchFilterBootstrapOptions = {
  author?: string;
  styles?: string[];
  usages?: string[];
};

function normalizeSearchFilterSlugs(values?: string[]) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

const getCachedSearchTypeFilters = unstable_cache(
  async () =>
    db.tag.findMany({
      where: {
        type: TagType.TYPE
      },
      orderBy: [{ name: "asc" }]
    }),
  ["search-type-filters"],
  { revalidate: 300, tags: ["tags"] }
);

export async function getSearchFilterBootstrap(options: SearchFilterBootstrapOptions) {
  const authorSlug = options.author?.trim();
  const styleSlugs = normalizeSearchFilterSlugs(options.styles);
  const usageSlugs = normalizeSearchFilterSlugs(options.usages);

  const [types, selectedAuthor, selectedStyles, selectedUsages] = await Promise.all([
    getCachedSearchTypeFilters(),
    authorSlug
      ? db.tag.findFirst({
          where: {
            type: TagType.AUTHOR,
            slug: authorSlug
          }
        })
      : Promise.resolve(null),
    styleSlugs.length
      ? db.tag.findMany({
          where: {
            type: TagType.STYLE,
            slug: {
              in: styleSlugs
            }
          },
          orderBy: [{ name: "asc" }]
        })
      : Promise.resolve([]),
    usageSlugs.length
      ? db.tag.findMany({
          where: {
            type: TagType.USAGE,
            slug: {
              in: usageSlugs
            }
          },
          orderBy: [{ name: "asc" }]
        })
      : Promise.resolve([])
  ]);

  return {
    types,
    selectedAuthor,
    selectedStyles,
    selectedUsages
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

type SearchContentFilters = {
  author?: string;
  styles?: string[];
  usages?: string[];
  types?: string[];
};

const SEARCH_RESULTS_SELECT = {
  id: true,
  title: true,
  slug: true,
  description: true,
  coverImageUrl: true,
  reviewStatus: true,
  contentTags: {
    select: {
      tag: {
        select: {
          name: true,
          type: true,
          slug: true
        }
      }
    }
  }
} satisfies Prisma.ContentSelect;

function normalizeSearchSlugs(values?: string[]) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].sort();
}

function buildSearchWhere(isLoggedIn: boolean, filters: SearchContentFilters): Prisma.ContentWhereInput {
  const styleSlugs = normalizeSearchSlugs(filters.styles);
  const usageSlugs = normalizeSearchSlugs(filters.usages);
  const typeSlugs = normalizeSearchSlugs(filters.types);
  const andConditions: Prisma.ContentWhereInput[] = [
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

  const authorSlug = filters.author?.trim();

  return {
    publishStatus: {
      in: getVisibleStatuses(isLoggedIn)
    },
    ...(authorSlug
      ? {
          contentTags: {
            some: {
              tag: {
                slug: authorSlug,
                type: TagType.AUTHOR
              }
            }
          }
        }
      : {}),
    ...(andConditions.length ? { AND: andConditions } : {})
  };
}

const getCachedPublicSearchResults = unstable_cache(
  async (author?: string, styles?: string[], usages?: string[], types?: string[], safePage = 1, safePageSize = 24) => {
    const where = buildSearchWhere(false, { author, styles, usages, types });

    const [totalCount, items] = await Promise.all([
      db.content.count({ where }),
      db.content.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
        select: SEARCH_RESULTS_SELECT
      })
    ]);

    return {
      items,
      totalCount,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / safePageSize))
    };
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
  page?: number;
  pageSize?: number;
}) {
  const safePage = Number.isInteger(filters.page) && (filters.page ?? 0) > 0 ? (filters.page as number) : 1;
  const safePageSize = Number.isInteger(filters.pageSize) && (filters.pageSize ?? 0) > 0 ? (filters.pageSize as number) : 24;
  const normalizedAuthor = filters.author?.trim();
  const normalizedStyles = normalizeSearchSlugs(filters.styles);
  const normalizedUsages = normalizeSearchSlugs(filters.usages);
  const normalizedTypes = normalizeSearchSlugs(filters.types);

  if (!filters.isLoggedIn) {
    return getCachedPublicSearchResults(
      normalizedAuthor,
      normalizedStyles,
      normalizedUsages,
      normalizedTypes,
      safePage,
      safePageSize
    );
  }

  const where = buildSearchWhere(filters.isLoggedIn, filters);
  const [totalCount, items] = await Promise.all([
    db.content.count({ where }),
    db.content.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
      select: SEARCH_RESULTS_SELECT
    })
  ]);

  return {
    items,
    totalCount,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / safePageSize))
  };
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

export async function getAdminContentsPage(options?: {
  reviewStatus?: "all" | "unverified" | "edited" | "passed";
  page?: number;
  pageSize?: number;
}) {
  const reviewStatus = options?.reviewStatus ?? "all";
  const page = Number.isInteger(options?.page) && (options?.page ?? 0) > 0 ? (options?.page as number) : 1;
  const pageSize =
    Number.isInteger(options?.pageSize) && (options?.pageSize ?? 0) > 0 ? (options?.pageSize as number) : 20;

  const where = {
    ...(reviewStatus === "unverified"
      ? { reviewStatus: ReviewStatus.UNVERIFIED }
      : reviewStatus === "edited"
        ? { reviewStatus: ReviewStatus.EDITED }
        : reviewStatus === "passed"
          ? { reviewStatus: ReviewStatus.PASSED }
          : {})
  };

  const [totalCount, items] = await Promise.all([
    db.content.count({ where }),
    db.content.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        slug: true,
        publishStatus: true,
        reviewStatus: true,
        firstEditedAt: true,
        editedAt: true,
        firstEditedBy: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true
          }
        },
        editedBy: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true
          }
        }
      }
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

export async function getAdminContentReviewCounts() {
  const grouped = await db.content.groupBy({
    by: ["reviewStatus"],
    _count: {
      _all: true
    }
  });

  const counts = new Map(grouped.map((item) => [item.reviewStatus, item._count._all]));

  return {
    unverified: counts.get(ReviewStatus.UNVERIFIED) ?? 0,
    edited: counts.get(ReviewStatus.EDITED) ?? 0,
    passed: counts.get(ReviewStatus.PASSED) ?? 0
  };
}

export async function getAdminContentById(id: number) {
  return db.content.findUnique({
    where: { id },
    include: {
      hostedFiles: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        include: {
          uploadedBy: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true
            }
          }
        }
      },
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

export async function saveContent(
  input: unknown,
  contentId?: number,
  options?: { reviewStatusOverride?: ReviewStatus; reviewHandledByUserId?: number; passHandledByUserId?: number }
) {
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
  const normalizedManualDownloadLinks = [...new Set(data.downloadLinks.map((url) => url.trim()).filter(Boolean))];
  let mergedDownloadLinks = normalizedManualDownloadLinks;
  const existingContentForTracking = contentId
    ? await db.content.findUnique({
        where: { id: contentId },
        select: {
          firstEditedByUserId: true,
          firstEditedAt: true
        }
      })
    : null;

  if (contentId) {
    const hostedFiles = await db.contentFile.findMany({
      where: { contentId },
      select: { id: true, objectKey: true }
    });

    if (hostedFiles.length) {
      const hostedDownloadLinks = hostedFiles.map((file) => buildContentFileDownloadPath(file.id));
      const legacyHostedDownloadLinks = new Set([
        ...hostedFiles.map((file) => buildR2PublicUrl(file.objectKey)),
        ...hostedFiles.map((file) => buildLegacyContentFileDownloadPath(file.id))
      ]);
      const manualLinks = normalizedManualDownloadLinks.filter((url) => !legacyHostedDownloadLinks.has(url));
      mergedDownloadLinks = [...new Set([...manualLinks, ...hostedDownloadLinks])];
    }
  }

  const nextReviewStatus = options?.reviewStatusOverride ?? data.reviewStatus;
  const now = new Date();
  const shouldSetFirstEdited =
    nextReviewStatus === ReviewStatus.EDITED &&
    Boolean(options?.reviewHandledByUserId) &&
    !existingContentForTracking?.firstEditedByUserId;

  const editedTrackingUpdate =
    nextReviewStatus === ReviewStatus.UNVERIFIED
      ? {
          editedByUserId: null,
          editedAt: null,
          firstEditedByUserId: null,
          firstEditedAt: null,
          passedByUserId: null,
          passedAt: null
        }
      : nextReviewStatus === ReviewStatus.EDITED
        ? {
            editedByUserId: options?.reviewHandledByUserId ?? null,
            editedAt: now,
            firstEditedByUserId: shouldSetFirstEdited
              ? options?.reviewHandledByUserId ?? null
              : (existingContentForTracking?.firstEditedByUserId ?? null),
            firstEditedAt: shouldSetFirstEdited ? now : (existingContentForTracking?.firstEditedAt ?? null),
            passedByUserId: null,
            passedAt: null
          }
        : nextReviewStatus === ReviewStatus.PASSED
          ? {
              passedByUserId: options?.passHandledByUserId ?? null,
              passedAt: now
            }
        : {};

  const editedTrackingCreate =
    nextReviewStatus === ReviewStatus.EDITED
      ? {
          editedByUserId: options?.reviewHandledByUserId ?? null,
          editedAt: now,
          firstEditedByUserId: options?.reviewHandledByUserId ?? null,
          firstEditedAt: now,
          passedByUserId: null,
          passedAt: null
        }
      : nextReviewStatus === ReviewStatus.PASSED
        ? {
          editedByUserId: null,
          editedAt: null,
          firstEditedByUserId: null,
          firstEditedAt: null,
          passedByUserId: options?.passHandledByUserId ?? null,
          passedAt: now
          }
      : {
          editedByUserId: null,
          editedAt: null,
          firstEditedByUserId: null,
          firstEditedAt: null,
          passedByUserId: null,
          passedAt: null
        };

  try {
    const content = await db.content.upsert({
      where: { id: contentId ?? -1 },
      update: {
        title: data.title,
        slug: data.slug,
        description: data.description,
        coverImageUrl: data.coverImageUrl,
        sourceLink: data.sourceLink ?? null,
        isVerified: nextReviewStatus === ReviewStatus.PASSED,
        reviewStatus: nextReviewStatus,
        ...editedTrackingUpdate,
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
          create: mergedDownloadLinks.map((url, index) => ({
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
        isVerified: nextReviewStatus === ReviewStatus.PASSED,
        reviewStatus: nextReviewStatus,
        ...editedTrackingCreate,
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
          create: mergedDownloadLinks.map((url, index) => ({
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

    revalidateTag("tags", "max");

    return { ok: true as const, contentId: content.id };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return { ok: false as const, error: "Slug already exists" };
    }
    return { ok: false as const, error: "Failed to save content" };
  }
}
