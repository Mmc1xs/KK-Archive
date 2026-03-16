"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

type SearchTagOption = {
  id: number;
  name: string;
  slug: string;
};

type SearchFiltersProps = {
  authors: SearchTagOption[];
  styles: SearchTagOption[];
  usages: SearchTagOption[];
  types: SearchTagOption[];
  initialAuthor?: string;
  initialStyles: string[];
  initialUsages: string[];
  initialTypes: string[];
};

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
  authors,
  styles,
  usages,
  types,
  initialAuthor,
  initialStyles,
  initialUsages,
  initialTypes
}: SearchFiltersProps) {
  const [selectedAuthor, setSelectedAuthor] = useState<SearchTagOption | null>(null);
  const [authorQuery, setAuthorQuery] = useState("");
  const [authorOpen, setAuthorOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [selectedStyles, setSelectedStyles] = useState(initialStyles);
  const [selectedUsages, setSelectedUsages] = useState(initialUsages);
  const [selectedTypes, setSelectedTypes] = useState(initialTypes);
  const [styleExpanded, setStyleExpanded] = useState(true);
  const [usageExpanded, setUsageExpanded] = useState(true);
  const authorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initial = authors.find((author) => author.slug === initialAuthor) ?? null;
    setSelectedAuthor(initial);
    setAuthorQuery(initial?.name ?? "");
  }, [authors, initialAuthor]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!authorRef.current?.contains(event.target as Node)) {
        setAuthorOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const filteredAuthors = useMemo(() => {
    const normalized = authorQuery.trim().toLowerCase();

    return authors.filter((author) => {
      if (!normalized) {
        return true;
      }

      return author.name.toLowerCase().includes(normalized) || author.slug.toLowerCase().includes(normalized);
    });
  }, [authorQuery, authors]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [authorQuery]);

  function toggleSelection(current: string[], slug: string) {
    return current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug];
  }

  function selectAuthor(author: SearchTagOption) {
    setSelectedAuthor(author);
    setAuthorQuery(author.name);
    setAuthorOpen(false);
    setHighlightedIndex(0);
  }

  function clearAuthor() {
    setSelectedAuthor(null);
    setAuthorQuery("");
    setAuthorOpen(false);
    setHighlightedIndex(0);
  }

  function handleAuthorChange(value: string) {
    setAuthorQuery(value);
    setAuthorOpen(true);

    if (selectedAuthor && value !== selectedAuthor.name) {
      setSelectedAuthor(null);
    }
  }

  function handleAuthorKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!filteredAuthors.length) {
      if (event.key === "Escape") {
        setAuthorOpen(false);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setAuthorOpen(true);
      setHighlightedIndex((current) => Math.min(current + 1, filteredAuthors.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter" && authorOpen) {
      event.preventDefault();
      selectAuthor(filteredAuthors[highlightedIndex]);
      return;
    }

    if (event.key === "Escape") {
      setAuthorOpen(false);
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
              onChange={(event) => handleAuthorChange(event.target.value)}
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
              {filteredAuthors.length ? (
                filteredAuthors.slice(0, 8).map((author, index) => (
                  <button
                    key={`author-${author.id}`}
                    type="button"
                    className={index === highlightedIndex ? "search-author-option active" : "search-author-option"}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectAuthor(author)}
                  >
                    <span>{author.name}</span>
                    <small>{author.slug}</small>
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
        <div className="filter-section-header">
          <span>Style</span>
          <button
            type="button"
            className="filter-collapse-button"
            onClick={() => setStyleExpanded((current) => !current)}
            aria-expanded={styleExpanded}
          >
            {styleExpanded ? "Hide" : "Show"}
          </button>
        </div>

        {styleExpanded ? (
          <div className="filter-pill-group">
            {styles.map((option) => {
              const isActive = selectedStyles.includes(option.slug);

              return (
                <button
                  key={`styles-${option.id}`}
                  type="button"
                  className={isActive ? "filter-pill active" : "filter-pill"}
                  onClick={() => setSelectedStyles((current) => toggleSelection(current, option.slug))}
                  aria-pressed={isActive}
                >
                  {option.name}
                </button>
              );
            })}
          </div>
        ) : null}

        {selectedStyles.map((slug) => (
          <input key={`styles-${slug}`} type="hidden" name="styles" value={slug} />
        ))}
      </div>

      <div className="field">
        <div className="filter-section-header">
          <span>Usage</span>
          <button
            type="button"
            className="filter-collapse-button"
            onClick={() => setUsageExpanded((current) => !current)}
            aria-expanded={usageExpanded}
          >
            {usageExpanded ? "Hide" : "Show"}
          </button>
        </div>

        {usageExpanded ? (
          <div className="filter-pill-group">
            {usages.map((option) => {
              const isActive = selectedUsages.includes(option.slug);

              return (
                <button
                  key={`usages-${option.id}`}
                  type="button"
                  className={isActive ? "filter-pill active" : "filter-pill"}
                  onClick={() => setSelectedUsages((current) => toggleSelection(current, option.slug))}
                  aria-pressed={isActive}
                >
                  {option.name}
                </button>
              );
            })}
          </div>
        ) : null}

        {selectedUsages.map((slug) => (
          <input key={`usages-${slug}`} type="hidden" name="usages" value={slug} />
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
