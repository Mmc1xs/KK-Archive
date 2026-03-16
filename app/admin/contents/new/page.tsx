import { ContentForm } from "@/components/content-form";
import { requireAdmin } from "@/lib/auth/session";
import { getTagOptions } from "@/lib/tag";

export default async function NewContentPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const [params, tagOptions] = await Promise.all([searchParams, getTagOptions()]);
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <div className="page-section admin-layout">
      <ContentForm mode="create" error={error} tagOptions={tagOptions} />
    </div>
  );
}
