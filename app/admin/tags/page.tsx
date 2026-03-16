import { TagForm } from "@/components/tag-form";
import { requireAdmin } from "@/lib/auth/session";
import { getAllTags } from "@/lib/tag";

export default async function AdminTagsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const [params, tags] = await Promise.all([searchParams, getAllTags()]);
  const error = typeof params.error === "string" ? params.error : undefined;
  const success = typeof params.success === "string" ? params.success : undefined;

  return (
    <div className="page-section admin-layout">
      <TagForm error={error} />
      {success ? <div className="notice">{success}</div> : null}
      <section className="panel">
        <div className="eyebrow">Existing Tags</div>
        <h1 className="title-lg">Tag List</h1>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {tags.map((tag) => (
              <tr key={tag.id}>
                <td>{tag.name}</td>
                <td>{tag.slug}</td>
                <td>{tag.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
