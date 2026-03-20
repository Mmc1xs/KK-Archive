import { TagForm } from "@/components/tag-form";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminTagsPage } from "@/lib/tag";
import Link from "next/link";
import { deleteTagAction } from "@/app/actions";
import { TagType } from "@prisma/client";

const PAGE_SIZE_OPTIONS = [50, 100, 200] as const;

function buildPagination(totalPages: number, currentPage: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1) as Array<number | "ellipsis">;
  }

  const pages = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);

  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }

  if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }

  const sortedPages = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const items: Array<number | "ellipsis"> = [];

  sortedPages.forEach((page, index) => {
    if (index > 0 && page - sortedPages[index - 1] > 1) {
      items.push("ellipsis");
    }
    items.push(page);
  });

  return items;
}

function buildAdminTagsHref(page: number, pageSize: number) {
  const params = new URLSearchParams();

  if (page > 1) {
    params.set("page", String(page));
  }

  if (pageSize !== 50) {
    params.set("pageSize", String(pageSize));
  }

  const query = params.toString();
  return query ? `/admin/tags?${query}` : "/admin/tags";
}

export default async function AdminTagsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin({ touchActivity: false });
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const success = typeof params.success === "string" ? params.success : undefined;
  const pageParam = typeof params.page === "string" ? Number(params.page) : 1;
  const pageSizeParam = typeof params.pageSize === "string" ? Number(params.pageSize) : 50;
  const currentPage = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const currentPageSize = PAGE_SIZE_OPTIONS.includes(pageSizeParam as 50 | 100 | 200) ? pageSizeParam : 50;

  const { items: tags, totalPages, totalCount } = await getAdminTagsPage({
    page: currentPage,
    pageSize: currentPageSize
  });
  const paginationItems = buildPagination(totalPages, currentPage);

  return (
    <div className="page-section admin-layout">
      <TagForm error={error} />
      {success ? <div className="notice">{success}</div> : null}
      <section className="panel">
        <div className="split">
          <div>
            <div className="eyebrow">Existing Tags</div>
            <h1 className="title-lg">Tag List</h1>
          </div>
          <div className="status">{`Page ${currentPage} / ${totalPages} - ${totalCount} tags`}</div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Type</th>
              <th>Work</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tags.map((tag) => (
              <tr key={tag.id}>
                <td>{tag.name}</td>
                <td>{tag.slug}</td>
                <td>{tag.type}</td>
                <td>{tag.type === TagType.CHARACTER ? (tag.workTag?.name ?? "-") : "-"}</td>
                <td>
                  {tag.type === TagType.TYPE ? (
                    <span className="muted">Fixed</span>
                  ) : (
                    <div className="inline-actions">
                      <Link href={`/admin/tags/${tag.id}/edit`} className="link-pill">
                        Edit
                      </Link>
                      <form action={deleteTagAction}>
                        <input type="hidden" name="tagId" value={tag.id} />
                        <input
                          type="hidden"
                          name="redirectTo"
                          value={buildAdminTagsHref(currentPage, currentPageSize)}
                        />
                        <button type="submit">Delete</button>
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 ? (
          <nav className="pagination-nav" aria-label="Admin tags pagination">
            <Link
              href={buildAdminTagsHref(currentPage > 1 ? currentPage - 1 : 1, currentPageSize)}
              className={currentPage > 1 ? "link-pill pagination-arrow" : "link-pill pagination-arrow pagination-disabled"}
              aria-disabled={currentPage <= 1}
            >
              Previous
            </Link>
            <div className="pagination-pages">
              {paginationItems.map((item, index) =>
                item === "ellipsis" ? (
                  <span key={`ellipsis-${index}`} className="pagination-ellipsis" aria-hidden="true">
                    ...
                  </span>
                ) : (
                  <Link
                    key={item}
                    href={buildAdminTagsHref(item, currentPageSize)}
                    className={item === currentPage ? "button secondary pagination-page-current" : "link-pill pagination-page"}
                    aria-current={item === currentPage ? "page" : undefined}
                  >
                    {item}
                  </Link>
                )
              )}
              <div className="pagination-page-size">
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <Link
                    key={size}
                    href={buildAdminTagsHref(1, size)}
                    className={size === currentPageSize ? "button secondary pagination-page-current" : "link-pill pagination-page"}
                  >
                    {size} / page
                  </Link>
                ))}
              </div>
            </div>
            <Link
              href={buildAdminTagsHref(currentPage < totalPages ? currentPage + 1 : totalPages, currentPageSize)}
              className={currentPage < totalPages ? "link-pill pagination-arrow" : "link-pill pagination-arrow pagination-disabled"}
              aria-disabled={currentPage >= totalPages}
            >
              Next
            </Link>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
