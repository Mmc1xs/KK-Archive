import Link from "next/link";
import {
  createHomepageBulletinAction,
  deleteHomepageBulletinAction,
  updateHomepageBulletinAction
} from "@/app/actions";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminHomepageBulletins } from "@/lib/content";
import type { UiLocale } from "@/lib/ui-locale";

type AdminHomepageBulletinSearchParams = Promise<{
  locale?: string;
  success?: string;
  error?: string;
}>;

const LOCALE_OPTIONS: UiLocale[] = ["zh-CN", "en", "ja"];

function getLocaleLabel(locale: UiLocale) {
  switch (locale) {
    case "zh-CN":
      return "中文";
    case "en":
      return "English";
    case "ja":
      return "日本語";
    default:
      return locale;
  }
}

function parseLocale(value?: string): UiLocale | undefined {
  if (!value) {
    return undefined;
  }

  return LOCALE_OPTIONS.includes(value as UiLocale) ? (value as UiLocale) : undefined;
}

function formatDateTimeLocalInput(value: Date | null | undefined) {
  if (!value) {
    return "";
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default async function AdminHomepageBulletinsPage({
  searchParams
}: {
  searchParams: AdminHomepageBulletinSearchParams;
}) {
  await requireAdmin({ touchActivity: false });
  const params = await searchParams;
  const localeFilter = parseLocale(params.locale);
  const bulletins = await getAdminHomepageBulletins(localeFilter);

  return (
    <div className="page-section grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow">Admin Only</div>
            <h1 className="title-lg">Homepage Bulletin Manager</h1>
          </div>
          <div className="inline-actions">
            <Link href="/admin/homepage" className="button secondary">
              Back to Homepage Admin
            </Link>
            <Link href="/admin" className="button secondary">
              Dashboard
            </Link>
          </div>
        </div>

        {params.success ? <div className="notice success">{params.success}</div> : null}
        {params.error ? <div className="notice error">{params.error}</div> : null}

        <div className="inline-actions">
          <Link href="/admin/homepage/bulletins" className={`link-pill${localeFilter ? "" : " active"}`}>
            All
          </Link>
          {LOCALE_OPTIONS.map((localeOption) => (
            <Link
              key={localeOption}
              href={`/admin/homepage/bulletins?locale=${encodeURIComponent(localeOption)}`}
              className={`link-pill${localeFilter === localeOption ? " active" : ""}`}
            >
              {getLocaleLabel(localeOption)}
            </Link>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow">Create Bulletin</div>
            <h2 className="title-lg">New Entry</h2>
          </div>
        </div>
        <form action={createHomepageBulletinAction} className="admin-bulletin-form-grid">
          <input type="hidden" name="redirectTo" value="/admin/homepage/bulletins" />
          <label className="field-label">
            Locale
            <select name="locale" defaultValue={localeFilter ?? "zh-CN"} required>
              {LOCALE_OPTIONS.map((localeOption) => (
                <option key={localeOption} value={localeOption}>
                  {localeOption} ({getLocaleLabel(localeOption)})
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Sort Order
            <input name="sortOrder" type="number" min={0} max={9999} defaultValue={0} />
          </label>
          <label className="field-label admin-bulletin-span-2">
            Title
            <input name="title" type="text" maxLength={120} required />
          </label>
          <label className="field-label admin-bulletin-span-2">
            Summary
            <textarea name="summary" rows={3} maxLength={280} />
          </label>
          <label className="field-label admin-bulletin-span-2">
            Link URL (optional)
            <input name="linkUrl" type="url" placeholder="https://..." />
          </label>
          <label className="field-label">
            Published At (optional)
            <input name="publishedAt" type="datetime-local" />
          </label>
          <label className="field-label">
            Starts At (optional)
            <input name="startsAt" type="datetime-local" />
          </label>
          <label className="field-label">
            Ends At (optional)
            <input name="endsAt" type="datetime-local" />
          </label>
          <label className="field-label field-label-checkbox">
            <input name="isActive" type="checkbox" defaultChecked />
            Active
          </label>
          <label className="field-label field-label-checkbox">
            <input name="isPinned" type="checkbox" />
            Pinned
          </label>
          <div className="inline-actions admin-bulletin-span-2">
            <button type="submit" className="button">
              Create Bulletin
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow">Current Entries</div>
            <h2 className="title-lg">Editable Bulletin List</h2>
          </div>
          <span className="status-pill">{bulletins.length} item(s)</span>
        </div>

        <div className="admin-bulletin-list">
          {bulletins.map((bulletin) => (
            <article key={bulletin.id} className="admin-bulletin-item">
              <form action={updateHomepageBulletinAction} className="admin-bulletin-form-grid">
                <input type="hidden" name="bulletinId" value={bulletin.id} />
                <input type="hidden" name="redirectTo" value={localeFilter ? `/admin/homepage/bulletins?locale=${localeFilter}` : "/admin/homepage/bulletins"} />
                <label className="field-label">
                  Locale
                  <select name="locale" defaultValue={bulletin.locale} required>
                    {LOCALE_OPTIONS.map((localeOption) => (
                      <option key={localeOption} value={localeOption}>
                        {localeOption} ({getLocaleLabel(localeOption)})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  Sort Order
                  <input name="sortOrder" type="number" min={0} max={9999} defaultValue={bulletin.sortOrder} />
                </label>
                <label className="field-label admin-bulletin-span-2">
                  Title
                  <input name="title" type="text" maxLength={120} defaultValue={bulletin.title} required />
                </label>
                <label className="field-label admin-bulletin-span-2">
                  Summary
                  <textarea name="summary" rows={3} maxLength={280} defaultValue={bulletin.summary} />
                </label>
                <label className="field-label admin-bulletin-span-2">
                  Link URL
                  <input name="linkUrl" type="url" placeholder="https://..." defaultValue={bulletin.linkUrl ?? ""} />
                </label>
                <label className="field-label">
                  Published At
                  <input
                    name="publishedAt"
                    type="datetime-local"
                    defaultValue={formatDateTimeLocalInput(bulletin.publishedAt)}
                  />
                </label>
                <label className="field-label">
                  Starts At
                  <input
                    name="startsAt"
                    type="datetime-local"
                    defaultValue={formatDateTimeLocalInput(bulletin.startsAt)}
                  />
                </label>
                <label className="field-label">
                  Ends At
                  <input
                    name="endsAt"
                    type="datetime-local"
                    defaultValue={formatDateTimeLocalInput(bulletin.endsAt)}
                  />
                </label>
                <label className="field-label field-label-checkbox">
                  <input name="isActive" type="checkbox" defaultChecked={bulletin.isActive} />
                  Active
                </label>
                <label className="field-label field-label-checkbox">
                  <input name="isPinned" type="checkbox" defaultChecked={bulletin.isPinned} />
                  Pinned
                </label>
                <div className="inline-actions admin-bulletin-span-2">
                  <button type="submit" className="button secondary">
                    Update
                  </button>
                </div>
              </form>

              <form action={deleteHomepageBulletinAction} className="inline-actions">
                <input type="hidden" name="bulletinId" value={bulletin.id} />
                <input type="hidden" name="redirectTo" value={localeFilter ? `/admin/homepage/bulletins?locale=${localeFilter}` : "/admin/homepage/bulletins"} />
                <button type="submit" className="button secondary">
                  Delete
                </button>
              </form>
            </article>
          ))}

          {!bulletins.length ? <div className="muted">No bulletin entries yet.</div> : null}
        </div>
      </section>
    </div>
  );
}
