import Link from "next/link";
import {
  createModLibraryEntryAction,
  deleteModLibraryEntryAction,
  updateModLibraryEntryAction
} from "@/app/actions";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminModLibraryPage } from "@/lib/mod-library";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

function parsePositiveInt(value: string | string[] | undefined, fallback: number) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeQuery(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function buildAdminModLibraryHref({
  query,
  page,
  pageSize
}: {
  query: string;
  page: number;
  pageSize: number;
}) {
  const params = new URLSearchParams();
  if (query) {
    params.set("q", query);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  if (pageSize !== 50) {
    params.set("pageSize", String(pageSize));
  }
  const serialized = params.toString();
  return serialized ? `/admin/mod-library?${serialized}` : "/admin/mod-library";
}

export default async function AdminModLibraryPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin({ touchActivity: false });
  const params = await searchParams;
  const query = normalizeQuery(params.q);
  const page = parsePositiveInt(params.page, 1);
  const pageSizeRaw = parsePositiveInt(params.pageSize, 50);
  const pageSize = PAGE_SIZE_OPTIONS.includes(pageSizeRaw as 25 | 50 | 100) ? pageSizeRaw : 50;
  const success = typeof params.success === "string" ? params.success : "";
  const error = typeof params.error === "string" ? params.error : "";

  const pageResult = await getAdminModLibraryPage({ query, page, pageSize });

  const redirectTo = buildAdminModLibraryHref({
    query,
    page: pageResult.currentPage,
    pageSize: pageResult.pageSize
  });

  return (
    <div className="page-section grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow">Admin Only</div>
            <h1 className="title-lg">Mod Library Manager</h1>
            <p className="muted">Search and manage mod entries.</p>
          </div>
          <div className="inline-actions">
            <Link href="/admin" className="button secondary">
              Back to Dashboard
            </Link>
            <Link href={buildAdminModLibraryHref({ query: "", page: 1, pageSize })} className="link-pill">
              Reset Filters
            </Link>
          </div>
        </div>

        {success ? <div className="notice success">{success}</div> : null}
        {error ? <div className="notice error">{error}</div> : null}

        <div className="mod-library-admin-toolbar">
          <form action="/admin/mod-library" method="get" className="inline-actions mod-library-search-form">
            <label className="field-label mod-library-search-label">
              Search mod (name / guid / author)
              <input name="q" type="text" defaultValue={query} placeholder="Type name / guid / author" />
            </label>
            <label className="field-label">
              Page Size
              <select name="pageSize" defaultValue={String(pageSize)}>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="button secondary">
              Search
            </button>
          </form>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow">Create Entry</div>
            <h2 className="title-lg">New Mod</h2>
          </div>
        </div>
        <form action={createModLibraryEntryAction} className="mod-library-admin-form">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <label className="field-label">
            Name
            <input name="name" type="text" required />
          </label>
          <label className="field-label">
            Version
            <input name="version" type="text" />
          </label>
          <label className="field-label">
            Author
            <input name="author" type="text" />
          </label>
          <label className="field-label">
            Guid
            <input name="guid" type="text" required />
          </label>
          <label className="field-label">
            Filename
            <input name="filename" type="text" required />
          </label>
          <label className="field-label">
            Message Link (TG)
            <input name="messageLink" type="text" placeholder="https://t.me/your_channel/12345" />
          </label>
          <div className="inline-actions">
            <button type="submit" className="button">
              Create Mod Entry
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="split">
          <div>
            <div className="eyebrow">Current Mod Entries</div>
            <h2 className="title-lg">List</h2>
          </div>
          <div className="status">{`Page ${pageResult.currentPage} / ${pageResult.totalPages} - ${pageResult.totalCount} mods`}</div>
        </div>

        <div className="mod-library-list">
          {pageResult.items.map((item) => (
            <article key={`admin-mod-${item.id}`} className="mod-library-item">
              <form action={updateModLibraryEntryAction} className="mod-library-admin-form">
                <input type="hidden" name="modId" value={item.id} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <label className="field-label">
                  Name
                  <input name="name" type="text" defaultValue={item.name} required />
                </label>
                <label className="field-label">
                  Version
                  <input name="version" type="text" defaultValue={item.version} />
                </label>
                <label className="field-label">
                  Author
                  <input name="author" type="text" defaultValue={item.author} />
                </label>
                <label className="field-label">
                  Guid
                  <input name="guid" type="text" defaultValue={item.guid} required />
                </label>
                <label className="field-label">
                  Filename
                  <input name="filename" type="text" defaultValue={item.filename} required />
                </label>
                <label className="field-label">
                  Message Link (TG)
                  <input
                    name="messageLink"
                    type="text"
                    defaultValue={item.messageLink}
                    placeholder="https://t.me/your_channel/12345"
                  />
                </label>
                <div className="inline-actions">
                  <button type="submit" className="button secondary">
                    Update
                  </button>
                  <button type="submit" formAction={deleteModLibraryEntryAction} formNoValidate className="button secondary">
                    Delete
                  </button>
                </div>
              </form>
            </article>
          ))}
          {!pageResult.items.length ? <div className="muted">No mod entries found.</div> : null}
        </div>
      </section>
    </div>
  );
}
