import { ContentCard } from "@/components/content-card";
import { SearchFilters } from "@/components/search-filters";
import { getCurrentSession } from "@/lib/auth/session";
import { getSearchFilters, searchPublishedContents } from "@/lib/content";

function readValues(value: string | string[] | undefined) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export default async function SearchPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const author = typeof params.author === "string" ? params.author : undefined;
  const styles = readValues(params.styles);
  const usages = readValues(params.usages);
  const types = readValues(params.types);
  const user = await getCurrentSession();

  const [filters, results] = await Promise.all([
    getSearchFilters(),
    searchPublishedContents({ isLoggedIn: Boolean(user), author, styles, usages, types })
  ]);

  return (
    <div className="page-section search-layout">
      <aside className="panel">
        <div className="eyebrow">Search Filters</div>
        <h1 className="title-lg">Tag Search</h1>
        <SearchFilters
          authors={filters.authors}
          styles={filters.styles}
          usages={filters.usages}
          types={filters.types}
          initialAuthor={author}
          initialStyles={styles}
          initialUsages={usages}
          initialTypes={types}
        />
      </aside>

      <section className="panel">
        <div className="split">
          <div>
            <div className="eyebrow">Visible Results</div>
            <h2 className="title-lg">Search Results</h2>
          </div>
          <span className="status">{results.length} results</span>
        </div>

        <div className="grid content-grid">
          {results.map((content) => (
            <ContentCard key={content.id} content={content} />
          ))}
        </div>
      </section>
    </div>
  );
}
