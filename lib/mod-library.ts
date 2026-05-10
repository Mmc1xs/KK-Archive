import { Prisma } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { modLibraryBindingSchema, modLibraryEntrySchema } from "@/lib/validation";

type ModLibraryRow = {
  id: number;
  name: string;
  version: string;
  author: string;
  guid: string;
  filename: string;
  messageLink: string;
  createdAt: Date;
  updatedAt: Date;
};

type ModLibraryBindingRow = {
  contentId: number;
  modId: number;
  note: string;
  createdAt: Date;
  content: {
    id: number;
    slug: string;
    title: string;
    publishStatus: string;
    reviewStatus: string;
  };
};

type ModLibraryPageOptions = {
  query?: string;
  page?: number;
  pageSize?: number;
};

type ModLibraryPageResult = {
  items: ModLibraryRow[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  databaseReady: boolean;
};

type AdminModLibraryItem = ModLibraryRow & {
  bindingCount: number;
  bindings: ModLibraryBindingRow[];
};

type AdminModLibraryPageResult = Omit<ModLibraryPageResult, "items"> & {
  items: AdminModLibraryItem[];
};

type ModLibraryJsonRow = {
  Name: string;
  Version: string;
  Author: string;
  Guid: string;
  Filename: string;
  Location?: string;
  MessageLink?: string;
  messageLink?: string;
};

const MODS_TABLE_PATH = path.join(process.cwd(), "db mods", "mods_table.json");

const MOD_LIBRARY_SELECT = {
  id: true,
  name: true,
  version: true,
  author: true,
  guid: true,
  filename: true,
  messageLink: true,
  createdAt: true,
  updatedAt: true
} as const;

let modsJsonCache:
  | {
      loadedAt: number;
      rows: ModLibraryJsonRow[];
    }
  | null = null;

function normalizeQuery(value?: string) {
  return String(value ?? "").trim();
}

function normalizePage(value?: number) {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : 1;
}

function normalizePageSize(value?: number) {
  const size = Number(value);
  if (!Number.isInteger(size) || size <= 0) {
    return 50;
  }
  return Math.min(size, 200);
}

function buildWhere(query: string): Prisma.ModLibraryEntryWhereInput | undefined {
  if (!query) {
    return undefined;
  }

  return {
    OR: [
      { name: { contains: query, mode: "insensitive" } },
      { guid: { contains: query, mode: "insensitive" } },
      { author: { contains: query, mode: "insensitive" } }
    ]
  };
}

function buildOrderBy() {
  return [{ updatedAt: "desc" as const }, { id: "desc" as const }];
}

function isMissingTableError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021";
}

async function loadModsTableSnapshot() {
  const now = Date.now();
  if (modsJsonCache && now - modsJsonCache.loadedAt < 60_000) {
    return modsJsonCache.rows;
  }

  try {
    const raw = await readFile(MODS_TABLE_PATH, "utf8");
    const cleaned = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      modsJsonCache = { loadedAt: now, rows: [] };
      return [];
    }

    const rows = parsed.filter((item): item is ModLibraryJsonRow => {
      return (
        item &&
        typeof item === "object" &&
        typeof item.Name === "string" &&
        typeof item.Version === "string" &&
        typeof item.Author === "string" &&
        typeof item.Guid === "string" &&
        typeof item.Filename === "string"
      );
    });

    modsJsonCache = {
      loadedAt: now,
      rows
    };
    return rows;
  } catch {
    modsJsonCache = { loadedAt: now, rows: [] };
    return [];
  }
}

function getFilteredModsTableRows(rows: ModLibraryJsonRow[], query: string) {
  if (!query) {
    return rows;
  }

  const needle = query.toLowerCase();
  return rows.filter((row) => {
    return (
      row.Name.toLowerCase().includes(needle) ||
      row.Guid.toLowerCase().includes(needle) ||
      row.Author.toLowerCase().includes(needle)
    );
  });
}

function mapModsTableRow(row: ModLibraryJsonRow, index: number): ModLibraryRow {
  const messageLink = typeof row.MessageLink === "string"
    ? row.MessageLink
    : typeof row.messageLink === "string"
      ? row.messageLink
      : "";

  return {
    id: index + 1,
    name: row.Name,
    version: row.Version,
    author: row.Author,
    guid: row.Guid,
    filename: row.Filename,
    messageLink,
    createdAt: new Date(0),
    updatedAt: new Date(0)
  };
}

async function getFileFallbackPage(options: ModLibraryPageOptions): Promise<ModLibraryPageResult> {
  const query = normalizeQuery(options.query);
  const currentPage = normalizePage(options.page);
  const pageSize = normalizePageSize(options.pageSize);
  const rows = await loadModsTableSnapshot();
  const filtered = getFilteredModsTableRows(rows, query);
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paged = filtered.slice(startIndex, startIndex + pageSize);

  return {
    items: paged.map((row, index) => mapModsTableRow(row, startIndex + index)),
    totalCount,
    totalPages,
    currentPage: safePage,
    pageSize,
    databaseReady: false
  };
}

export async function getModLibraryPage(options: ModLibraryPageOptions = {}): Promise<ModLibraryPageResult> {
  const query = normalizeQuery(options.query);
  const currentPage = normalizePage(options.page);
  const pageSize = normalizePageSize(options.pageSize);
  const where = buildWhere(query);

  try {
    const [totalCount, items] = await Promise.all([
      db.modLibraryEntry.count({ where }),
      db.modLibraryEntry.findMany({
        where,
        orderBy: buildOrderBy(),
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
        select: MOD_LIBRARY_SELECT
      })
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    return {
      items,
      totalCount,
      totalPages,
      currentPage: Math.min(currentPage, totalPages),
      pageSize,
      databaseReady: true
    };
  } catch (error) {
    if (isMissingTableError(error)) {
      return getFileFallbackPage({ query, page: currentPage, pageSize });
    }
    throw error;
  }
}

export async function getAdminModLibraryPage(options: ModLibraryPageOptions = {}): Promise<AdminModLibraryPageResult> {
  const query = normalizeQuery(options.query);
  const currentPage = normalizePage(options.page);
  const pageSize = normalizePageSize(options.pageSize);
  const where = buildWhere(query);

  try {
    const [totalCount, items] = await Promise.all([
      db.modLibraryEntry.count({ where }),
      db.modLibraryEntry.findMany({
        where,
        orderBy: buildOrderBy(),
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
        select: {
          ...MOD_LIBRARY_SELECT,
          bindings: {
            orderBy: { createdAt: "desc" },
            take: 8,
            select: {
              contentId: true,
              modId: true,
              note: true,
              createdAt: true,
              content: {
                select: {
                  id: true,
                  slug: true,
                  title: true,
                  publishStatus: true,
                  reviewStatus: true
                }
              }
            }
          },
          _count: {
            select: {
              bindings: true
            }
          }
        }
      })
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    return {
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        version: item.version,
        author: item.author,
        guid: item.guid,
        filename: item.filename,
        messageLink: item.messageLink,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        bindingCount: item._count.bindings,
        bindings: item.bindings
      })),
      totalCount,
      totalPages,
      currentPage: Math.min(currentPage, totalPages),
      pageSize,
      databaseReady: true
    };
  } catch (error) {
    if (isMissingTableError(error)) {
      const fallback = await getFileFallbackPage({ query, page: currentPage, pageSize });
      return {
        ...fallback,
        items: fallback.items.map((item) => ({
          ...item,
          bindingCount: 0,
          bindings: []
        }))
      };
    }
    throw error;
  }
}

export async function searchAdminBindableContents(query: string, limit = 20) {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return [];
  }

  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 50) : 20;
  return db.content.findMany({
    where: {
      OR: [
        { slug: { contains: normalized, mode: "insensitive" } },
        { title: { contains: normalized, mode: "insensitive" } }
      ]
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: safeLimit,
    select: {
      id: true,
      slug: true,
      title: true,
      publishStatus: true,
      reviewStatus: true
    }
  });
}

export async function saveModLibraryEntry(input: unknown, modId?: number) {
  const parsed = modLibraryEntrySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid mod payload"
    };
  }

  try {
    if (Number.isInteger(modId) && Number(modId) > 0) {
      const updated = await db.modLibraryEntry.update({
        where: { id: Number(modId) },
        data: parsed.data,
        select: { id: true }
      });
      return { ok: true as const, modId: updated.id };
    }

    const created = await db.modLibraryEntry.create({
      data: parsed.data,
      select: { id: true }
    });
    return { ok: true as const, modId: created.id };
  } catch (error) {
    if (isMissingTableError(error)) {
      return {
        ok: false as const,
        error: "Mod library table is not ready. Please run Prisma migration/db push first."
      };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { ok: false as const, error: "Mod entry not found" };
    }

    return {
      ok: false as const,
      error: "Failed to save mod entry"
    };
  }
}

export async function deleteModLibraryEntry(modId: number) {
  if (!Number.isInteger(modId) || modId <= 0) {
    return { ok: false as const, error: "Invalid mod id" };
  }

  try {
    await db.modLibraryEntry.delete({
      where: { id: modId }
    });
    return { ok: true as const };
  } catch (error) {
    if (isMissingTableError(error)) {
      return {
        ok: false as const,
        error: "Mod library table is not ready. Please run Prisma migration/db push first."
      };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { ok: false as const, error: "Mod entry not found" };
    }
    return { ok: false as const, error: "Failed to delete mod entry" };
  }
}

export async function bindModToContent(input: unknown) {
  const parsed = modLibraryBindingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid binding payload"
    };
  }

  const payload = parsed.data;
  try {
    const [mod, content] = await Promise.all([
      db.modLibraryEntry.findUnique({
        where: { id: payload.modId },
        select: { id: true }
      }),
      db.content.findUnique({
        where: { id: payload.contentId },
        select: { id: true }
      })
    ]);

    if (!mod) {
      return { ok: false as const, error: "Mod entry not found" };
    }
    if (!content) {
      return { ok: false as const, error: "Content not found" };
    }

    await db.contentModBinding.upsert({
      where: {
        contentId_modId: {
          contentId: payload.contentId,
          modId: payload.modId
        }
      },
      update: {
        note: payload.note
      },
      create: {
        contentId: payload.contentId,
        modId: payload.modId,
        note: payload.note
      }
    });

    return { ok: true as const };
  } catch (error) {
    if (isMissingTableError(error)) {
      return {
        ok: false as const,
        error: "Mod binding table is not ready. Please run Prisma migration/db push first."
      };
    }
    return { ok: false as const, error: "Failed to bind mod to content" };
  }
}

export async function unbindModFromContent(modId: number, contentId: number) {
  if (!Number.isInteger(modId) || modId <= 0 || !Number.isInteger(contentId) || contentId <= 0) {
    return { ok: false as const, error: "Invalid binding target" };
  }

  try {
    await db.contentModBinding.delete({
      where: {
        contentId_modId: {
          contentId,
          modId
        }
      }
    });
    return { ok: true as const };
  } catch (error) {
    if (isMissingTableError(error)) {
      return {
        ok: false as const,
        error: "Mod binding table is not ready. Please run Prisma migration/db push first."
      };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { ok: false as const, error: "Binding not found" };
    }
    return { ok: false as const, error: "Failed to remove binding" };
  }
}
