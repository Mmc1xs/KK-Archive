"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

type SearchTagOption = {
  id: number;
  name: string;
  slug: string;
};

type SearchFiltersProps = {
  types: SearchTagOption[];
  initialAuthor?: SearchTagOption | null;
  initialStyles: SearchTagOption[];
  initialUsages: SearchTagOption[];
  initialTypes: string[];
};

type SearchableTagType = "AUTHOR" | "STYLE" | "USAGE";

const MAX_SELECTED_STYLES = 8;
const SUGGESTION_LIMIT = 12;
const SEARCH_DEBOUNCE_MS = 180;

async function fetchTagSuggestions(options: {
  type: SearchableTagType;
  query: string;
  excludeSlugs?: string[];
}) {
  const params = new URLSearchParams({
    type: options.type,
    q: options.query,
    limit: String(SUGGESTION_LIMIT)
  });

  (options.excludeSlugs ?? []).forEach((slug) => params.append("exclude", slug));

  const response = await fetch(`/api/tags/search?${params.toString()}`, {
    credentials: "same-origin",
    cache: "no-store"
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as { items?: SearchTagOption[] };
  return data.items ?? [];
}

function SearchToggleGroup({
  label,
  name,
  options,
  selected,
  onToggle
}: {
  label: string;
  name: string;
  options: SearchTagOption[];
  selected: string[];
  onToggle: (slug: string) => void;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="filter-pill-group">
        {options.map((option) => {
          const isActive = selected.includes(option.slug);

          return (
            <button
              key={`${name}-${option.id}`}
              type="button"
              className={isActive ? "filter-pill active" : "filter-pill"}
              onClick={() => onToggle(option.slug)}
              aria-pressed={isActive}
            >
              {option.name}
            </button>
          );
        })}
      </div>
      {selected.map((slug) => (
        <input key={`${name}-${slug}`} type="hidden" name={name} value={slug} />
      ))}
    </div>
  );
}

export function SearchFilters({
  types,
  initialAuthor = null,
  initialStyles,
  initialUsages,
  initialTypes
}: SearchFiltersProps) {
  const [selectedAuthor, setSelectedAuthor] = useState<SearchTagOption | null>(initialAuthor);
  const [authorQuery, setAuthorQuery] = useState(initialAuthor?.name ?? "");
  const [authorOptions, setAuthorOptions] = useState<SearchTagOption[]>([]);
  const [authorOpen, setAuthorOpen] = useState(false);
  const [authorLoading, setAuthorLoading] = useState(false);
  const [authorHighlight, setAuthorHighlight] = useState(0);

  const [selectedStyles, setSelectedStyles] = useState<SearchTagOption[]>(initialStyles);
  const [styleQuery, setStyleQuery] = useState("");
  const [styleOptions, setStyleOptions] = useState<SearchTagOption[]>([]);
  const [styleOpen, setStyleOpen] = useState(false);
  const [styleLoading, setStyleLoading] = useState(false);
  const [styleHighlight, setStyleHighlight] = useState(0);

  const [selectedUsages, setSelectedUsages] = useState<SearchTagOption[]>(initialUsages);
  const [usageQuery, setUsageQuery] = useState("");
  const [usageOptions, setUsageOptions] = useState<SearchTagOption[]>([]);
  const [usageOpen, setUsageOpen] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageHighlight, setUsageHighlight] = useState(0);

  const [selectedTypes, setSelectedTypes] = useState(initialTypes);

  const authorRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const usageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const styleKey = initialStyles.map((item) => item.slug).sort().join("|");
    const usageKey = initialUsages.map((item) => item.slug).sort().join("|");
    setSelectedAuthor(initialAuthor);
    setAuthorQuery(initialAuthor?.name ?? "");
    setSelectedStyles(initialStyles);
    setSelectedUsages(initialUsages);
    setSelectedTypes(initialTypes);
    return () => {
      void styleKey;
      void usageKey;
    };
  }, [
    initialAuthor?.id,
    initialAuthor?.slug,
    initialAuthor?.name,
    initialStyles,
    initialUsages,
    initialTypes
  ]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const node = event.target as Node;
      if (!authorRef.current?.contains(node)) {
        setAuthorOpen(false);
      }
      if (!styleRef.current?.contains(node)) {
        setStyleOpen(false);
      }
      if (!usageRef.current?.contains(node)) {
        setUsageOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const selectedStyleSlugs = useMemo(() => selectedStyles.map((item) => item.slug), [selectedStyles]);
  const selectedUsageSlugs = useMemo(() => selectedUsages.map((item) => item.slug), [selectedUsages]);

  useEffect(() => {
    if (!authorOpen) {
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setAuthorLoading(true);
      const items = await fetchTagSuggestions({
        type: "AUTHOR",
        query: authorQuery
      });
      if (active) {
        setAuthorOptions(items);
        setAuthorHighlight(0);
        setAuthorLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [authorOpen, authorQuery]);

  useEffect(() => {
    if (!styleOpen) {
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setStyleLoading(true);
      const items = await fetchTagSuggestions({
        type: "STYLE",
        query: styleQuery,
        excludeSlugs: selectedStyleSlugs
      });
      if (active) {
        setStyleOptions(items);
        setStyleHighlight(0);
        setStyleLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [styleOpen, styleQuery, selectedStyleSlugs]);

  useEffect(() => {
    if (!usageOpen) {
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setUsageLoading(true);
      const items = await fetchTagSuggestions({
        type: "USAGE",
        query: usageQuery,
        excludeSlugs: selectedUsageSlugs
      });
      if (active) {
        setUsageOptions(items);
        setUsageHighlight(0);
        setUsageLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [usageOpen, usageQuery, selectedUsageSlugs]);

  function toggleSelection(current: string[], slug: string) {
    return current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug];
  }

  function selectAuthor(option: SearchTagOption) {
    setSelectedAuthor(option);
    setAuthorQuery(option.name);
    setAuthorOpen(false);
  }

  function clearAuthor() {
    setSelectedAuthor(null);
    setAuthorQuery("");
    setAuthorOpen(false);
    setAuthorHighlight(0);
  }

  function handleAuthorKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!authorOptions.length) {
      if (event.key === "Escape") {
        setAuthorOpen(false);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setAuthorOpen(true);
      setAuthorHighlight((current) => Math.min(current + 1, authorOptions.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setAuthorHighlight((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter" && authorOpen) {
      event.preventDefault();
      const option = authorOptions[authorHighlight];
      if (option) {
        selectAuthor(option);
      }
      return;
    }

    if (event.key === "Escape") {
      setAuthorOpen(false);
    }
  }

  function addStyle(option: SearchTagOption) {
    setSelectedStyles((current) => {
      if (current.some((item) => item.slug === option.slug)) {
        return current;
      }
      if (current.length >= MAX_SELECTED_STYLES) {
        return current;
      }
      return [...current, option];
    });
    setStyleQuery("");
    setStyleOpen(true);
  }

  function removeStyle(slug: string) {
    setSelectedStyles((current) => current.filter((item) => item.slug !== slug));
  }

  function handleStyleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!styleOptions.length) {
      if (event.key === "Escape") {
        setStyleOpen(false);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setStyleOpen(true);
      setStyleHighlight((current) => Math.min(current + 1, styleOptions.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setStyleHighlight((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter" && styleOpen) {
      event.preventDefault();
      const option = styleOptions[styleHighlight];
      if (option) {
        addStyle(option);
      }
      return;
    }

    if (event.key === "Escape") {
      setStyleOpen(false);
    }
  }

  function addUsage(option: SearchTagOption) {
    setSelectedUsages((current) => {
      if (current.some((item) => item.slug === option.slug)) {
        return current;
      }
      return [...current, option];
    });
    setUsageQuery("");
    setUsageOpen(true);
  }

  function removeUsage(slug: string) {
    setSelectedUsages((current) => current.filter((item) => item.slug !== slug));
  }

  function handleUsageKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!usageOptions.length) {
      if (event.key === "Escape") {
        setUsageOpen(false);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setUsageOpen(true);
      setUsageHighlight((current) => Math.min(current + 1, usageOptions.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setUsageHighlight((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter" && usageOpen) {
      event.preventDefault();
      const option = usageOptions[usageHighlight];
      if (option) {
        addUsage(option);
      }
      return;
    }

    if (event.key === "Escape") {
      setUsageOpen(false);
    }
  }

  return (
    <form method="get" className="grid">
      <div className="field">
        <label htmlFor="author-search">Author</label>
        <div className="search-author-picker" ref={authorRef}>
          <div className="search-author-input-wrap">
            <input
              id="author-search"
              type="text"
              value={authorQuery}
              onChange={(event) => {
                const nextQuery = event.target.value;
                setAuthorQuery(nextQuery);
                setAuthorOpen(true);
                if (selectedAuthor && nextQuery !== selectedAuthor.name) {
                  setSelectedAuthor(null);
                }
              }}
              onFocus={() => setAuthorOpen(true)}
              onKeyDown={handleAuthorKeyDown}
              placeholder="Search author"
              autoComplete="off"
            />
            {selectedAuthor ? (
              <button type="button" className="search-inline-clear" onClick={clearAuthor}>
                Clear
              </button>
            ) : null}
          </div>

          {selectedAuthor ? <input type="hidden" name="author" value={selectedAuthor.slug} /> : null}

          {authorOpen ? (
            <div className="search-author-panel">
              {authorLoading ? (
                <div className="search-author-empty">Searching...</div>
              ) : authorOptions.length ? (
                authorOptions.map((author, index) => (
                  <button
                    key={`author-${author.id}`}
                    type="button"
                    className={index === authorHighlight ? "search-author-option active" : "search-author-option"}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectAuthor(author)}
                  >
                    <span className="search-author-label">{author.name || "Unknown author"}</span>
                  </button>
                ))
              ) : (
                <div className="search-author-empty">No matching authors.</div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <SearchToggleGroup
        label="Type"
        name="types"
        options={types}
        selected={selectedTypes}
        onToggle={(slug) => setSelectedTypes((current) => toggleSelection(current, slug))}
      />

      <div className="field">
        <label htmlFor="style-search">{`Style (${selectedStyles.length}/${MAX_SELECTED_STYLES})`}</label>
        {selectedStyles.length ? (
          <div className="filter-pill-group search-style-selected">
            {selectedStyles.map((option) => (
              <button
                key={`styles-selected-${option.id}`}
                type="button"
                className="filter-pill active"
                onClick={() => removeStyle(option.slug)}
                aria-pressed={true}
              >
                {option.name} x
              </button>
            ))}
          </div>
        ) : (
          <small className="filter-helper-text">No style selected.</small>
        )}

        <div className="search-author-picker" ref={styleRef}>
          <div className="search-author-input-wrap">
            <input
              id="style-search"
              type="text"
              value={styleQuery}
              onChange={(event) => {
                setStyleQuery(event.target.value);
                setStyleOpen(true);
              }}
              onFocus={() => setStyleOpen(true)}
              onKeyDown={handleStyleKeyDown}
              placeholder="Search style"
              autoComplete="off"
            />
          </div>

          {styleOpen ? (
            <div className="search-author-panel">
              {styleLoading ? (
                <div className="search-author-empty">Searching...</div>
              ) : styleOptions.length ? (
                styleOptions.map((option, index) => (
                  <button
                    key={`styles-${option.id}`}
                    type="button"
                    className={index === styleHighlight ? "search-author-option active" : "search-author-option"}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => addStyle(option)}
                    disabled={selectedStyles.length >= MAX_SELECTED_STYLES}
                    title={
                      selectedStyles.length >= MAX_SELECTED_STYLES
                        ? `Maximum ${MAX_SELECTED_STYLES} style tags`
                        : undefined
                    }
                  >
                    <span className="search-author-label">{option.name}</span>
                  </button>
                ))
              ) : (
                <div className="search-author-empty">No matching styles.</div>
              )}
            </div>
          ) : null}
        </div>

        {selectedStyles.map((item) => (
          <input key={`styles-${item.slug}`} type="hidden" name="styles" value={item.slug} />
        ))}
      </div>

      <div className="field">
        <label htmlFor="usage-search">Usage</label>
        {selectedUsages.length ? (
          <div className="filter-pill-group search-style-selected">
            {selectedUsages.map((option) => (
              <button
                key={`usages-selected-${option.id}`}
                type="button"
                className="filter-pill active"
                onClick={() => removeUsage(option.slug)}
                aria-pressed={true}
              >
                {option.name} x
              </button>
            ))}
          </div>
        ) : (
          <small className="filter-helper-text">No usage selected.</small>
        )}

        <div className="search-author-picker" ref={usageRef}>
          <div className="search-author-input-wrap">
            <input
              id="usage-search"
              type="text"
              value={usageQuery}
              onChange={(event) => {
                setUsageQuery(event.target.value);
                setUsageOpen(true);
              }}
              onFocus={() => setUsageOpen(true)}
              onKeyDown={handleUsageKeyDown}
              placeholder="Search usage"
              autoComplete="off"
            />
          </div>

          {usageOpen ? (
            <div className="search-author-panel">
              {usageLoading ? (
                <div className="search-author-empty">Searching...</div>
              ) : usageOptions.length ? (
                usageOptions.map((option, index) => (
                  <button
                    key={`usages-${option.id}`}
                    type="button"
                    className={index === usageHighlight ? "search-author-option active" : "search-author-option"}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => addUsage(option)}
                  >
                    <span className="search-author-label">{option.name}</span>
                  </button>
                ))
              ) : (
                <div className="search-author-empty">No matching usages.</div>
              )}
            </div>
          ) : null}
        </div>

        {selectedUsages.map((item) => (
          <input key={`usages-${item.slug}`} type="hidden" name="usages" value={item.slug} />
        ))}
      </div>

      <div className="inline-actions">
        <button type="submit">Apply Filters</button>
        <a href="/search" className="link-pill">
          Clear
        </a>
      </div>
    </form>
  );
}
