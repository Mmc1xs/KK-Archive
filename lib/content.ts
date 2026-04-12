import { cache } from "react";
import { Prisma, PublishStatus, ReviewStatus, TagType, UserRole } from "@prisma/client";
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

async function generateUniqueCharacterSlug(name: string, workTagId: number) {
  const baseSlug = `character-${workTagId}-${slugifyTagName(name)}`;
  let slug = baseSlug;
  let counter = 2;

  while (await db.tag.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return slug;
}

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

function getTaipeiDayBucket(date = new Date()) {
  const shifted = new Date(date.getTime() + TAIPEI_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - TAIPEI_OFFSET_MS);
}

function getTaipeiMonthBucket(date = new Date()) {
  const shifted = new Date(date.getTime() + TAIPEI_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) - TAIPEI_OFFSET_MS);
}

function getNextTaipeiMonthBucket(date = new Date()) {
  const shifted = new Date(date.getTime() + TAIPEI_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 1) - TAIPEI_OFFSET_MS);
}

function getPreviousTaipeiMonthBucket(date = new Date()) {
  const shifted = new Date(date.getTime() + TAIPEI_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() - 1, 1) - TAIPEI_OFFSET_MS);
}

function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export const HOMEPAGE_HOT_TOPIC_SLOT_COUNT = 8;

const HOMEPAGE_CONTENT_INCLUDE = {
  contentTags: {
    include: {
      tag: true
    }
  }
} satisfies Prisma.ContentInclude;

type HomepageContent = Prisma.ContentGetPayload<{
  include: typeof HOMEPAGE_CONTENT_INCLUDE;
}>;

type HomepageHotTopicSlotWithContent = {
  slot: number;
  content: HomepageContent | null;
};

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

async function resolveCharacterTagIds(existingIds: number[], newNames: string[], workTagId: number) {
  const ids: number[] = [];
  const uniqueExistingIds = [...new Set(existingIds)];
  const normalizedNewNames = [...new Set(newNames.map((name) => name.trim()).filter(Boolean))];

  if (uniqueExistingIds.length) {
    const existingCharacters = await db.tag.findMany({
      where: {
        id: { in: uniqueExistingIds },
        type: TagType.CHARACTER
      }
    });

    if (existingCharacters.length !== uniqueExistingIds.length) {
      throw new Error("Character tag not found");
    }

    const invalidCharacter = existingCharacters.find((tag) => tag.workTagId !== workTagId);
    if (invalidCharacter) {
      throw new Error("Selected character does not belong to the selected work");
    }

    ids.push(...existingCharacters.map((tag) => tag.id));
  }

  for (const newName of normalizedNewNames) {
    const existingByName = await db.tag.findFirst({
      where: {
        type: TagType.CHARACTER,
        workTagId,
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
        slug: await generateUniqueCharacterSlug(newName, workTagId),
        type: TagType.CHARACTER,
        workTagId
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
      take: 16,
      include: HOMEPAGE_CONTENT_INCLUDE
    }),
  ["homepage-contents"],
  { revalidate: 600 }
);

const getCachedHomepageHotTopicSlots = unstable_cache(
  async () =>
    db.homepageHotTopicSlot.findMany({
      orderBy: { slot: "asc" },
      include: {
        content: {
          include: HOMEPAGE_CONTENT_INCLUDE
        }
      }
    }),
  ["homepage-hot-topic-slots"],
  { revalidate: 300 }
);

function buildHomepageSlotState(
  rows: Array<{
    slot: number;
    content: HomepageContent | null;
  }>,
  options?: { publishedOnly?: boolean }
) {
  const publishedOnly = options?.publishedOnly ?? false;
  const slotMap = new Map(rows.map((row) => [row.slot, row.content]));

  return Array.from({ length: HOMEPAGE_HOT_TOPIC_SLOT_COUNT }, (_, index) => {
    const slot = index + 1;
    const content = slotMap.get(slot) ?? null;

    return {
      slot,
      content:
        publishedOnly && content?.publishStatus !== PublishStatus.PUBLISHED
          ? null
          : content
    };
  });
}

export async function getHomepageContents() {
  return getCachedHomepageContents();
}

export async function getHomepageHotTopicSlots(): Promise<HomepageHotTopicSlotWithContent[]> {
  const rows = await getCachedHomepageHotTopicSlots();
  return buildHomepageSlotState(rows, { publishedOnly: true });
}

export async function getAdminHomepageHotTopicSlots(): Promise<HomepageHotTopicSlotWithContent[]> {
  const rows = await db.homepageHotTopicSlot.findMany({
    orderBy: { slot: "asc" },
    include: {
      content: {
        include: HOMEPAGE_CONTENT_INCLUDE
      }
    }
  });

  return buildHomepageSlotState(rows);
}

export async function getHomepageLatestPublishedContents() {
  const [slots, fallbackContents] = await Promise.all([
    getHomepageHotTopicSlots(),
    getCachedHomepageContents()
  ]);
  const selectedContentIds = slots
    .map((slot) => slot.content?.id ?? null)
    .filter((id): id is number => Number.isInteger(id));

  const latest = await db.content.findMany({
    where: {
      publishStatus: PublishStatus.PUBLISHED,
      ...(selectedContentIds.length
        ? {
            id: {
              notIn: selectedContentIds
            }
          }
        : {})
    },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: HOMEPAGE_CONTENT_INCLUDE
  });

  return latest.length ? latest : fallbackContents.slice(0, 8);
}

export async function getHomepageHotTopicContents() {
  const slots = await getHomepageHotTopicSlots();
  return slots
    .map((slot) => slot.content)
    .filter((content): content is HomepageContent => Boolean(content));
}

export async function getHomepageHotTopicPickerPage(page: number, pageSize: number) {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 12;
  const assignedRows = await db.homepageHotTopicSlot.findMany({
    select: {
      contentId: true
    }
  });
  const assignedContentIds = assignedRows
    .map((row) => row.contentId)
    .filter((id): id is number => Number.isInteger(id));
  const where = {
    publishStatus: PublishStatus.PUBLISHED,
    ...(assignedContentIds.length
      ? {
          id: {
            notIn: assignedContentIds
          }
        }
      : {})
  } satisfies Prisma.ContentWhereInput;

  const [totalCount, items] = await Promise.all([
    db.content.count({ where }),
    db.content.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
      include: HOMEPAGE_CONTENT_INCLUDE
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

const getCachedHomepageOverviewStats = unstable_cache(
  async () => {
    const [totalPosts, groupedTagCounts] = await Promise.all([
      db.content.count({
        where: {
          publishStatus: PublishStatus.PUBLISHED
        }
      }),
      db.tag.groupBy({
        by: ["type"],
        where: {
          type: {
            in: [TagType.AUTHOR, TagType.TYPE, TagType.STYLE, TagType.USAGE]
          }
        },
        _count: {
          _all: true
        }
      })
    ]);

    const tagCounts = new Map(
      groupedTagCounts.map((entry) => [entry.type, entry._count._all])
    );

    return {
      totalPosts,
      indexedAuthors: tagCounts.get(TagType.AUTHOR) ?? 0,
      fileTypes: tagCounts.get(TagType.TYPE) ?? 0,
      styleTags: tagCounts.get(TagType.STYLE) ?? 0,
      usageTags: tagCounts.get(TagType.USAGE) ?? 0
    };
  },
  ["homepage-overview-stats"],
  { revalidate: 600 }
);

export async function getHomepageOverviewStats() {
  return getCachedHomepageOverviewStats();
}

export async function recordContentView(contentId: number) {
  const viewedAt = new Date();
  const dayBucket = getTaipeiDayBucket(viewedAt);

  await db.contentViewDaily.upsert({
    where: {
      contentId_viewDate: {
        contentId,
        viewDate: dayBucket
      }
    },
    update: {
      viewCount: {
        increment: 1
      }
    },
    create: {
      contentId,
      viewDate: dayBucket,
      viewCount: 1
    }
  });
}

export async function recordContentDownload(contentId: number) {
  const downloadedAt = new Date();
  const dayBucket = getTaipeiDayBucket(downloadedAt);

  await db.contentDownloadDaily.upsert({
    where: {
      contentId_downloadDate: {
        contentId,
        downloadDate: dayBucket
      }
    },
    update: {
      downloadCount: {
        increment: 1
      }
    },
    create: {
      contentId,
      downloadDate: dayBucket,
      downloadCount: 1
    }
  });
}

export async function getContentViewAnalytics() {
  const now = new Date();
  const dayBucket = getTaipeiDayBucket(now);
  const nextDayBucket = addUtcDays(dayBucket, 1);
  const previousDayBucket = addUtcDays(dayBucket, -1);
  const monthBucket = getTaipeiMonthBucket(now);
  const nextMonthBucket = getNextTaipeiMonthBucket(now);
  const previousMonthBucket = getPreviousTaipeiMonthBucket(now);

  const [totalViews, viewedContentGroups, dayViews, previousDayViews, monthViews, previousMonthViews, topViewedGroups] = await Promise.all([
    db.contentViewDaily.aggregate({
      _sum: {
        viewCount: true
      }
    }),
    db.contentViewDaily.groupBy({
      by: ["contentId"]
    }),
    db.contentViewDaily.aggregate({
      _sum: {
        viewCount: true
      },
      where: {
        viewDate: {
          gte: dayBucket,
          lt: nextDayBucket
        }
      }
    }),
    db.contentViewDaily.aggregate({
      _sum: {
        viewCount: true
      },
      where: {
        viewDate: {
          gte: previousDayBucket,
          lt: dayBucket
        }
      }
    }),
    db.contentViewDaily.aggregate({
      _sum: {
        viewCount: true
      },
      where: {
        viewDate: {
          gte: monthBucket,
          lt: nextMonthBucket
        }
      }
    }),
    db.contentViewDaily.aggregate({
      _sum: {
        viewCount: true
      },
      where: {
        viewDate: {
          gte: previousMonthBucket,
          lt: monthBucket
        }
      }
    }),
    db.contentViewDaily.groupBy({
      by: ["contentId"],
      _sum: {
        viewCount: true
      },
      _max: {
        updatedAt: true
      },
      orderBy: [{ _sum: { viewCount: "desc" } }, { _max: { updatedAt: "desc" } }],
      take: 6,
    })
  ]);

  const topContentIds = topViewedGroups.map((item) => item.contentId);
  const topContentRecords = topContentIds.length
    ? await db.content.findMany({
        where: {
          id: {
            in: topContentIds
          }
        },
        select: {
          id: true,
          title: true,
          slug: true,
          publishStatus: true
        }
      })
    : [];
  const topContentMap = new Map(topContentRecords.map((item) => [item.id, item]));
  const topViewedContents = topViewedGroups
    .map((item) => {
      const content = topContentMap.get(item.contentId);
      if (!content) {
        return null;
      }

      return {
        ...content,
        viewCount: item._sum.viewCount ?? 0,
        lastViewedAt: item._max.updatedAt ?? null
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    totalViews: totalViews._sum.viewCount ?? 0,
    perDayViews: dayViews._sum.viewCount ?? 0,
    previousDayViews: previousDayViews._sum.viewCount ?? 0,
    perMonthViews: monthViews._sum.viewCount ?? 0,
    previousMonthViews: previousMonthViews._sum.viewCount ?? 0,
    viewedContents: viewedContentGroups.length,
    topViewedContents
  };
}

export async function getContentDownloadAnalytics() {
  const now = new Date();
  const dayBucket = getTaipeiDayBucket(now);
  const nextDayBucket = addUtcDays(dayBucket, 1);

  const [totalDownloads, dayDownloads] = await Promise.all([
    db.contentDownloadDaily.aggregate({
      _sum: {
        downloadCount: true
      }
    }),
    db.contentDownloadDaily.aggregate({
      _sum: {
        downloadCount: true
      },
      where: {
        downloadDate: {
          gte: dayBucket,
          lt: nextDayBucket
        }
      }
    })
  ]);

  return {
    totalDownloads: totalDownloads._sum.downloadCount ?? 0,
    perDayDownloads: dayDownloads._sum.downloadCount ?? 0
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
  { revalidate: 600 }
);

export async function getBrowsableContentBySlug(slug: string, isLoggedIn: boolean) {
  if (!isLoggedIn) {
    return getRequestScopedPublicBrowsableContentBySlug(slug);
  }

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
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          imageUrl: true,
          sortOrder: true
        }
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

const getCachedPublicBrowsableContentBySlug = unstable_cache(
  async (slug: string) =>
    db.content.findFirst({
      where: {
        slug,
        publishStatus: PublishStatus.PUBLISHED
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
  }),
  ["public-browsable-content-by-slug"],
  { revalidate: 900 }
);

const getRequestScopedPublicBrowsableContentBySlug = cache(async (slug: string) =>
  getCachedPublicBrowsableContentBySlug(slug)
);

const getCachedPublicBrowsableContentMetadataBySlug = unstable_cache(
  async (slug: string) =>
    db.content.findFirst({
      where: {
        slug,
        publishStatus: PublishStatus.PUBLISHED
      },
      select: {
        title: true,
        contentTags: {
          select: {
            tag: {
              select: {
                type: true,
                name: true
              }
            }
          }
        }
      }
  }),
  ["public-browsable-content-metadata-by-slug"],
  { revalidate: 1800 }
);

const getRequestScopedPublicBrowsableContentMetadataBySlug = cache(async (slug: string) =>
  getCachedPublicBrowsableContentMetadataBySlug(slug)
);

export async function getBrowsableContentMetadataBySlug(slug: string) {
  return getRequestScopedPublicBrowsableContentMetadataBySlug(slug);
}

export async function getSearchFilters() {
  const tags = await getCachedSearchFilters();

  return {
    authors: tags.filter((tag) => tag.type === TagType.AUTHOR),
    works: tags.filter((tag) => tag.type === TagType.WORK),
    characters: tags.filter((tag) => tag.type === TagType.CHARACTER),
    styles: tags.filter((tag) => tag.type === TagType.STYLE),
    usages: tags.filter((tag) => tag.type === TagType.USAGE),
    types: tags.filter((tag) => tag.type === TagType.TYPE)
  };
}

type SearchFilterBootstrapOptions = {
  author?: string;
  work?: string;
  character?: string;
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
  { revalidate: 900, tags: ["tags"] }
);

export async function getSearchFilterBootstrap(options: SearchFilterBootstrapOptions) {
  const authorSlug = options.author?.trim();
  const workSlug = options.work?.trim();
  const characterSlug = options.character?.trim();
  const styleSlugs = normalizeSearchFilterSlugs(options.styles);
  const usageSlugs = normalizeSearchFilterSlugs(options.usages);

  const [types, selectedAuthor, selectedWork, selectedStyles, selectedUsages] = await Promise.all([
    getCachedSearchTypeFilters(),
    authorSlug
      ? db.tag.findFirst({
          where: {
            type: TagType.AUTHOR,
            slug: authorSlug
          }
        })
      : Promise.resolve(null),
    workSlug
      ? db.tag.findFirst({
          where: {
            type: TagType.WORK,
            slug: workSlug
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

  const selectedCharacter =
    characterSlug && selectedWork
      ? await db.tag.findFirst({
          where: {
            type: TagType.CHARACTER,
            slug: characterSlug,
            workTagId: selectedWork.id
          }
        })
      : null;

  return {
    types,
    selectedAuthor,
    selectedWork,
    selectedCharacter,
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
  { revalidate: 900 }
);

type SearchContentFilters = {
  author?: string;
  work?: string;
  character?: string;
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
  const workSlug = filters.work?.trim();
  const characterSlug = filters.character?.trim();
  const andConditions: Prisma.ContentWhereInput[] = [
    ...(workSlug
      ? [
          {
            contentTags: {
              some: {
                tag: {
                  slug: workSlug,
                  type: TagType.WORK
                }
              }
            }
          } satisfies Prisma.ContentWhereInput
        ]
      : []),
    ...(characterSlug
      ? [
          {
            contentTags: {
              some: {
                tag: {
                  slug: characterSlug,
                  type: TagType.CHARACTER
                }
              }
            }
          } satisfies Prisma.ContentWhereInput
        ]
      : []),
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
  async (
    author?: string,
    work?: string,
    character?: string,
    styles?: string[],
    usages?: string[],
    types?: string[],
    safePage = 1,
    safePageSize = 24
  ) => {
    const where = buildSearchWhere(false, { author, work, character, styles, usages, types });

    const rows = await db.content.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize + 1,
      select: SEARCH_RESULTS_SELECT
    });
    const hasNext = rows.length > safePageSize;
    const items = hasNext ? rows.slice(0, safePageSize) : rows;

    return {
      items,
      page: safePage,
      pageSize: safePageSize,
      hasNext,
      hasPrevious: safePage > 1
    };
  },
  ["public-search-results"],
  { revalidate: 600 }
);

export async function searchPublishedContents(filters: {
  isLoggedIn: boolean;
  author?: string;
  work?: string;
  character?: string;
  styles?: string[];
  usages?: string[];
  types?: string[];
  page?: number;
  pageSize?: number;
}) {
  const safePage = Number.isInteger(filters.page) && (filters.page ?? 0) > 0 ? (filters.page as number) : 1;
  const safePageSize = Number.isInteger(filters.pageSize) && (filters.pageSize ?? 0) > 0 ? (filters.pageSize as number) : 24;
  const normalizedAuthor = filters.author?.trim();
  const normalizedWork = filters.work?.trim();
  const normalizedCharacter = filters.character?.trim();
  const normalizedStyles = normalizeSearchSlugs(filters.styles);
  const normalizedUsages = normalizeSearchSlugs(filters.usages);
  const normalizedTypes = normalizeSearchSlugs(filters.types);

  if (!filters.isLoggedIn) {
    return getCachedPublicSearchResults(
      normalizedAuthor,
      normalizedWork,
      normalizedCharacter,
      normalizedStyles,
      normalizedUsages,
      normalizedTypes,
      safePage,
      safePageSize
    );
  }

  const where = buildSearchWhere(filters.isLoggedIn, {
    ...filters,
    work: normalizedWork,
    character: normalizedCharacter,
    styles: normalizedStyles,
    usages: normalizedUsages,
    types: normalizedTypes
  });
  const rows = await db.content.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (safePage - 1) * safePageSize,
    take: safePageSize + 1,
    select: SEARCH_RESULTS_SELECT
  });
  const hasNext = rows.length > safePageSize;
  const items = hasNext ? rows.slice(0, safePageSize) : rows;

  return {
    items,
    page: safePage,
    pageSize: safePageSize,
    hasNext,
    hasPrevious: safePage > 1
  };
}

export async function getAdminContents(filter?: { reviewStatus?: "all" | "unverified" | "edited" | "passed" }) {
  const reviewStatus = filter?.reviewStatus ?? "all";
  const orderedStatuses = getAdminReviewStatusOrder(reviewStatus, UserRole.ADMIN);
  const results = await Promise.all(
    orderedStatuses.map((status) =>
      db.content.findMany({
        where: buildAdminContentWhere(status),
        orderBy: ADMIN_CONTENT_ORDER_BY,
        include: {
          contentTags: {
            include: { tag: true }
          }
        }
      })
    )
  );

  return results.flat();
}

type AdminContentReviewFilter = "all" | "unverified" | "edited" | "passed";

const ADMIN_REVIEW_STATUS_PRIORITY = [ReviewStatus.EDITED, ReviewStatus.UNVERIFIED, ReviewStatus.PASSED] as const;
const AUDIT_REVIEW_STATUS_PRIORITY = [ReviewStatus.UNVERIFIED, ReviewStatus.EDITED, ReviewStatus.PASSED] as const;
const ADMIN_CONTENT_ORDER_BY: Prisma.ContentOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "desc" }];
const ADMIN_CONTENT_PAGE_SELECT = {
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
} satisfies Prisma.ContentSelect;

function getReviewStatusFilterValue(reviewStatus: AdminContentReviewFilter) {
  switch (reviewStatus) {
    case "unverified":
      return ReviewStatus.UNVERIFIED;
    case "edited":
      return ReviewStatus.EDITED;
    case "passed":
      return ReviewStatus.PASSED;
    default:
      return null;
  }
}

function getAdminReviewStatusOrder(reviewStatus: AdminContentReviewFilter, viewerRole: UserRole) {
  const explicitStatus = getReviewStatusFilterValue(reviewStatus);
  if (explicitStatus) {
    return [explicitStatus];
  }

  return viewerRole === UserRole.AUDIT ? [...AUDIT_REVIEW_STATUS_PRIORITY] : [...ADMIN_REVIEW_STATUS_PRIORITY];
}

function buildAdminContentWhere(reviewStatus?: ReviewStatus): Prisma.ContentWhereInput {
  return reviewStatus ? { reviewStatus } : {};
}

export async function getAdminContentsPage(options?: {
  reviewStatus?: AdminContentReviewFilter;
  page?: number;
  pageSize?: number;
  viewerRole?: UserRole;
}) {
  const reviewStatus = options?.reviewStatus ?? "all";
  const page = Number.isInteger(options?.page) && (options?.page ?? 0) > 0 ? (options?.page as number) : 1;
  const pageSize =
    Number.isInteger(options?.pageSize) && (options?.pageSize ?? 0) > 0 ? (options?.pageSize as number) : 20;
  const viewerRole = options?.viewerRole === UserRole.AUDIT ? UserRole.AUDIT : UserRole.ADMIN;
  const orderedStatuses = getAdminReviewStatusOrder(reviewStatus, viewerRole);
  const statusCounts = await Promise.all(
    orderedStatuses.map(async (status) => ({
      status,
      count: await db.content.count({
        where: buildAdminContentWhere(status)
      })
    }))
  );
  const totalCount = statusCounts.reduce((sum, item) => sum + item.count, 0);
  const itemOffset = (page - 1) * pageSize;
  let remainingSkip = itemOffset;
  let remainingTake = pageSize;
  const items: Array<Prisma.ContentGetPayload<{ select: typeof ADMIN_CONTENT_PAGE_SELECT }>> = [];

  for (const { status, count } of statusCounts) {
    if (remainingTake <= 0) {
      break;
    }

    if (remainingSkip >= count) {
      remainingSkip -= count;
      continue;
    }

    const take = Math.min(remainingTake, count - remainingSkip);
    const rows = await db.content.findMany({
      where: buildAdminContentWhere(status),
      orderBy: ADMIN_CONTENT_ORDER_BY,
      skip: remainingSkip,
      take,
      select: ADMIN_CONTENT_PAGE_SELECT
    });

    items.push(...rows);
    remainingTake -= rows.length;
    remainingSkip = 0;
  }

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
  options?: {
    reviewStatusOverride?: ReviewStatus;
    reviewHandledByUserId?: number;
    passHandledByUserId?: number;
    preserveReviewStatus?: boolean;
  }
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
  const workSelections = data.workTagIds.length + data.workTagNames.length;
  const characterSelections = data.characterTagIds.length + data.characterTagNames.length;
  if (authorSelections !== 1) {
    return { ok: false as const, error: "Exactly one author is required" };
  }
  if (workSelections !== 1) {
    return { ok: false as const, error: "Exactly one work is required" };
  }
  if (characterSelections !== 1) {
    return { ok: false as const, error: "Exactly one character is required" };
  }

  const authorTagIds = await resolveTagIds(TagType.AUTHOR, data.authorTagIds, data.authorTagNames);
  const workTagIds = await resolveTagIds(TagType.WORK, data.workTagIds, data.workTagNames);

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

  const workTags = workTagIds.length
    ? await db.tag.findMany({
        where: {
          id: { in: workTagIds },
          type: TagType.WORK
        }
      })
    : [];
  if (workTags.length !== workTagIds.length || workTagIds.length !== 1) {
    return { ok: false as const, error: "Work tag not found" };
  }

  let characterTagIds: number[] = [];
  try {
    characterTagIds = await resolveCharacterTagIds(data.characterTagIds, data.characterTagNames, workTagIds[0]);
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Invalid character selection"
    };
  }

  const characterTags = characterTagIds.length
    ? await db.tag.findMany({
        where: {
          id: { in: characterTagIds },
          type: TagType.CHARACTER,
          workTagId: workTagIds[0]
        }
      })
    : [];

  if (characterTags.length !== characterTagIds.length || characterTagIds.length !== 1) {
    return { ok: false as const, error: "Character tag not found for selected work" };
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
  if (authorTagIds.length !== 1 || workTagIds.length !== 1 || characterTagIds.length !== 1) {
    return { ok: false as const, error: "Each content item must have exactly one author, one work, and one character tag." };
  }

  const tagIds = [...authorTagIds, ...workTagIds, ...characterTagIds, ...styleTagIds, ...usageTagIds, ...data.typeTagIds];
  const normalizedManualDownloadLinks = [...new Set(data.downloadLinks.map((url) => url.trim()).filter(Boolean))];
  let mergedDownloadLinks = normalizedManualDownloadLinks;
  const existingContentForTracking = contentId
    ? await db.content.findUnique({
        where: { id: contentId },
        select: {
          reviewStatus: true,
          editedByUserId: true,
          editedAt: true,
          firstEditedByUserId: true,
          firstEditedAt: true,
          passedByUserId: true,
          passedAt: true
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
      const allHostedDownloadLinks = new Set([
        ...hostedDownloadLinks,
        ...hostedFiles.map((file) => buildR2PublicUrl(file.objectKey)),
        ...hostedFiles.map((file) => buildLegacyContentFileDownloadPath(file.id))
      ]);
      const manualLinks = normalizedManualDownloadLinks.filter((url) => !allHostedDownloadLinks.has(url));
      mergedDownloadLinks = [...new Set([...manualLinks, ...hostedDownloadLinks])];
    }
  }

  const nextReviewStatus =
    options?.preserveReviewStatus && contentId && existingContentForTracking
      ? existingContentForTracking.reviewStatus
      : options?.reviewStatusOverride ?? data.reviewStatus;
  const now = new Date();
  const shouldSetFirstEdited =
    nextReviewStatus === ReviewStatus.EDITED &&
    Boolean(options?.reviewHandledByUserId) &&
    !existingContentForTracking?.firstEditedByUserId;
  const preserveReviewStatus = Boolean(options?.preserveReviewStatus && contentId && existingContentForTracking);

  const editedTrackingUpdate = preserveReviewStatus
    ? {}
    : nextReviewStatus === ReviewStatus.UNVERIFIED
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
    const sharedMutationData = {
      title: data.title,
      slug: data.slug,
      description: data.description,
      coverImageUrl: data.coverImageUrl,
      sourceLink: data.sourceLink ?? null,
      isVerified: nextReviewStatus === ReviewStatus.PASSED,
      reviewStatus: nextReviewStatus,
      publishStatus: data.publishStatus
    } satisfies Omit<Prisma.ContentUncheckedCreateInput, "contentTags" | "images" | "downloadLinks">;
    const content = await db.$transaction(async (tx) => {
      const savedContent = contentId
        ? await tx.content.update({
            where: { id: contentId },
            data: {
              ...sharedMutationData,
              ...editedTrackingUpdate
            }
          })
        : await tx.content.create({
            data: {
              ...sharedMutationData,
              ...editedTrackingCreate
            }
          });

      const nextContentId = savedContent.id;

      if (contentId) {
        await tx.contentTag.deleteMany({
          where: { contentId: nextContentId }
        });
        await tx.contentImage.deleteMany({
          where: { contentId: nextContentId }
        });
        await tx.contentDownloadLink.deleteMany({
          where: { contentId: nextContentId }
        });
      }

      if (tagIds.length) {
        await tx.contentTag.createMany({
          data: tagIds.map((tagId) => ({
            contentId: nextContentId,
            tagId
          }))
        });
      }

      if (data.imageUrls.length) {
        await tx.contentImage.createMany({
          data: data.imageUrls.map((imageUrl, index) => ({
            contentId: nextContentId,
            imageUrl,
            sortOrder: index
          }))
        });
      }

      if (mergedDownloadLinks.length) {
        await tx.contentDownloadLink.createMany({
          data: mergedDownloadLinks.map((url, index) => ({
            contentId: nextContentId,
            url,
            sortOrder: index
          }))
        });
      }

      return savedContent;
    });

    revalidateTag("tags", "max");

    return { ok: true as const, contentId: content.id };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return { ok: false as const, error: "Slug already exists" };
    }
    return { ok: false as const, error: "Failed to save content" };
  }
}
