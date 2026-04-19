import Image from "next/image";
import Link from "next/link";
import { clearHomepageHotTopicSlotAction, replaceHomepageHotTopicSlotAction } from "@/app/actions";
import { requireAdmin } from "@/lib/auth/session";
import { buildContentHref } from "@/lib/content-href";
import {
  HOMEPAGE_HOT_TOPIC_SLOT_COUNT,
  getAdminHomepageHotTopicSlots,
  getHomepageHotTopicPickerPage
} from "@/lib/content";

type AdminHomepageSearchParams = Promise<{
  slot?: string;
  pickerPage?: string;
  success?: string;
  error?: string;
}>;

function parsePositiveInteger(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export default async function AdminHomepagePage({
  searchParams
}: {
  searchParams: AdminHomepageSearchParams;
}) {
  await requireAdmin({ touchActivity: false });
  const params = await searchParams;
  const activeSlot = parsePositiveInteger(params.slot);
  const pickerPage = parsePositiveInteger(params.pickerPage) ?? 1;
  const hasActiveSlot =
    activeSlot !== null && activeSlot >= 1 && activeSlot <= HOMEPAGE_HOT_TOPIC_SLOT_COUNT;

  const [slots, picker] = await Promise.all([
    getAdminHomepageHotTopicSlots(),
    hasActiveSlot ? getHomepageHotTopicPickerPage(pickerPage, 12) : Promise.resolve(null)
  ]);

  return (
    <div className="page-section grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow">Admin Only</div>
            <h1 className="title-lg">Homepage Hot Topic</h1>
          </div>
          <div className="inline-actions">
            <Link href="/admin" className="button secondary">
              Back to Dashboard
            </Link>
            <Link href="/" className="button secondary">
              View Homepage
            </Link>
          </div>
        </div>

        {params.success ? <div className="notice success">{params.success}</div> : null}
        {params.error ? <div className="notice error">{params.error}</div> : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow">Homepage Slots</div>
            <h2 className="title-lg">Current Hot Topic Slots</h2>
          </div>
          <span className="status-pill">{HOMEPAGE_HOT_TOPIC_SLOT_COUNT} slots</span>
        </div>

        <div className="admin-homepage-slot-grid">
          {slots.map((slot) => {
            const content = slot.content;

            return (
              <article key={slot.slot} className="admin-homepage-slot-card">
                <div className="panel-header admin-homepage-slot-header">
                  <div>
                    <div className="eyebrow">Slot {slot.slot}</div>
                    <strong>{content?.title ?? "No content assigned"}</strong>
                    <small>{content?.slug ?? "Choose a published content entry for this slot."}</small>
                  </div>
                  <div className="admin-homepage-slot-actions">
                    <Link href={`/admin/homepage?slot=${slot.slot}`} className="button secondary">
                      Replace
                    </Link>
                    <form action={clearHomepageHotTopicSlotAction}>
                      <input type="hidden" name="slot" value={slot.slot} />
                      <button type="submit" className="button secondary" disabled={!content}>
                        Clear
                      </button>
                    </form>
                  </div>
                </div>

                {content ? (
                  <div className="admin-homepage-slot-content">
                    <Image
                      src={content.coverImageUrl}
                      alt={content.title}
                      className="admin-homepage-slot-image"
                      width={1200}
                      height={900}
                    />
                    <div className="admin-homepage-slot-copy">
                      <div className="eyebrow">Preview</div>
                      <h3>{content.title}</h3>
                      <p className="muted">{content.slug}</p>
                      <div className="inline-actions">
                        <Link href={buildContentHref(content.slug)} className="button secondary">
                          Open Content
                        </Link>
                        <Link href={`/admin/contents/${content.id}/edit`} className="link-pill">
                          Change Source
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="admin-homepage-slot-empty">
                    This slot is empty. Use Replace to choose a published content entry.
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {hasActiveSlot && picker ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Replace Slot</div>
              <h2 className="title-lg">Choose content for Slot {activeSlot}</h2>
            </div>
            <Link href="/admin/homepage" className="button secondary">
              Close Picker
            </Link>
          </div>

          <div className="admin-homepage-picker-grid">
            {picker.items.map((content) => (
              <article key={content.id} className="admin-homepage-picker-card">
                <Image
                  src={content.coverImageUrl}
                  alt={content.title}
                  className="admin-homepage-picker-image"
                  width={1200}
                  height={900}
                />
                <div className="admin-homepage-picker-copy">
                  <strong>{content.title}</strong>
                  <p className="muted">{content.slug}</p>
                  <div className="inline-actions">
                    <Link href={buildContentHref(content.slug)} className="link-pill">
                      Preview
                    </Link>
                    <form action={replaceHomepageHotTopicSlotAction}>
                      <input type="hidden" name="slot" value={activeSlot} />
                      <input type="hidden" name="contentId" value={content.id} />
                      <button type="submit" className="button secondary">
                        Use This Content
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {picker.totalPages > 1 ? (
            <div className="pagination-nav admin-homepage-picker-pagination">
              <Link
                href={
                  picker.page > 1
                    ? `/admin/homepage?slot=${activeSlot}&pickerPage=${picker.page - 1}`
                    : "#"
                }
                className={`button secondary${picker.page > 1 ? "" : " disabled"}`}
                aria-disabled={picker.page <= 1}
              >
                Previous
              </Link>
              <span className="status-pill">
                Page {picker.page} / {picker.totalPages}
              </span>
              <Link
                href={
                  picker.page < picker.totalPages
                    ? `/admin/homepage?slot=${activeSlot}&pickerPage=${picker.page + 1}`
                    : "#"
                }
                className={`button secondary${picker.page < picker.totalPages ? "" : " disabled"}`}
                aria-disabled={picker.page >= picker.totalPages}
              >
                Next
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
