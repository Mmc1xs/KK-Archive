import Link from "next/link";
import { redirect } from "next/navigation";
import { TagType } from "@prisma/client";
import { updateTagAction } from "@/app/actions";
import { requireAdmin } from "@/lib/auth/session";
import { getTagById } from "@/lib/tag";

export default async function AdminTagEditPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin({ touchActivity: false });
  const routeParams = await params;
  const queryParams = await searchParams;
  const tagId = Number(routeParams.id);
  const error = typeof queryParams.error === "string" ? queryParams.error : undefined;

  if (!Number.isInteger(tagId) || tagId <= 0) {
    redirect("/admin/tags?error=Invalid+tag+id");
  }

  const tag = await getTagById(tagId);
  if (!tag) {
    redirect("/admin/tags?error=Tag+not+found");
  }

  if (tag.type === TagType.TYPE) {
    redirect("/admin/tags?error=Type+tags+are+fixed+and+cannot+be+edited");
  }

  return (
    <section className="page-section panel">
      <div className="split">
        <div>
          <div className="eyebrow">Admin Tag Manager</div>
          <h1 className="title-lg">Edit Tag</h1>
        </div>
        <Link href="/admin/tags" className="link-pill">
          Back to Tag List
        </Link>
      </div>
      {error ? <div className="notice">{error}</div> : null}

      <form action={updateTagAction} className="grid">
        <input type="hidden" name="tagId" value={tag.id} />
        <input type="hidden" name="redirectTo" value={`/admin/tags/${tag.id}/edit`} />
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" defaultValue={tag.name} required />
        </div>
        <div className="field">
          <label htmlFor="slug">Slug</label>
          <input id="slug" name="slug" defaultValue={tag.slug} required />
        </div>
        <div className="field">
          <label htmlFor="type">Type</label>
          <input id="type" value={tag.type} disabled />
        </div>
        {tag.type === TagType.CHARACTER ? (
          <div className="field">
            <label htmlFor="workTag">Work</label>
            <input id="workTag" value={tag.workTag?.name ?? "-"} disabled />
          </div>
        ) : null}
        <button type="submit">Update Tag</button>
      </form>
    </section>
  );
}
