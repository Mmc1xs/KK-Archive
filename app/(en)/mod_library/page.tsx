import type { Metadata } from "next";
import { ModLibraryPageView } from "@/components/mod-library-page-view";
import { getModLibraryPage } from "@/lib/mod-library";

export const revalidate = 300;
export const preferredRegion = "hkg1";

export const metadata: Metadata = {
  title: "Mod Library | KK Archive",
  description: "Browse Koikatu/KK mod entries by mod name, guid, or author."
};

function parsePositiveInt(value: string | string[] | undefined, fallback: number) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export default async function ModLibraryPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const page = parsePositiveInt(params.page, 1);
  const pageSize = parsePositiveInt(params.pageSize, 50);
  const pageResult = await getModLibraryPage({ query, page, pageSize });

  return (
    <ModLibraryPageView
      locale="en"
      copy={{
        eyebrow: "Mod Library",
        title: "Shared Mod Index",
        description: "Search by mod name, guid, or author.",
        searchLabel: "Find mod",
        searchPlaceholder: "Type name / guid / author",
        searchButton: "Search",
        clearButton: "Clear",
        statusReady: "Live Data",
        statusDemo: "Demo Data",
        empty: "No mod entries found.",
        fields: {
          name: "Name",
          version: "Version",
          author: "Author",
          guid: "Guid",
          filename: "File",
          messageLink: "Message Link"
        },
        paginationLabel: "Mod library pagination",
        previous: "Previous",
        next: "Next"
      }}
      items={pageResult.items}
      query={query}
      currentPage={pageResult.currentPage}
      totalPages={pageResult.totalPages}
      totalCount={pageResult.totalCount}
      pageSize={pageResult.pageSize}
      databaseReady={pageResult.databaseReady}
    />
  );
}
