import { notFound } from "next/navigation";
import { ContentForm } from "@/components/content-form";
import { requireStaff } from "@/lib/auth/session";
import { getAdminContentById } from "@/lib/content";
import { getTagOptions } from "@/lib/tag";

export default async function EditContentPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const staff = await requireStaff({ touchActivity: false });
  const routeParams = await params;
  const contentId = Number(routeParams.id);
  const [query, tagOptions, content] = await Promise.all([
    searchParams,
    getTagOptions(),
    getAdminContentById(contentId)
  ]);

  if (!content) {
    notFound();
  }

  const error = typeof query.error === "string" ? query.error : undefined;

  return (
    <div className="page-section admin-layout">
      <ContentForm
        mode="edit"
        error={error}
        tagOptions={tagOptions}
        content={{
          id: content.id,
          title: content.title,
          slug: content.slug,
          description: content.description,
          coverImageUrl: content.coverImageUrl,
          sourceLink: content.sourceLink,
          reviewStatus: content.reviewStatus,
          publishStatus: content.publishStatus,
          images: content.images,
          downloadLinks: content.downloadLinks,
          contentTags: content.contentTags
        }}
        role={staff.role}
      />
    </div>
  );
}
