"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

type TagOption = {
  id: number;
  name: string;
  slug: string;
};

type SelectedTag = {
  id?: number;
  name: string;
  slug?: string;
  isNew?: boolean;
};

type SearchableTagType = "AUTHOR" | "STYLE" | "USAGE";

type TagAutocompleteProps = {
  label: string;
  idName: string;
  newName: string;
  tagType: SearchableTagType;
  initialSelectedTags?: TagOption[];
  multiple?: boolean;
  required?: boolean;
  placeholder: string;
};

const OPTION_LIMIT = 10;
const SEARCH_DEBOUNCE_MS = 180;

async function fetchTagSuggestions(options: {
  type: SearchableTagType;
  query: string;
  excludeSlugs?: string[];
}) {
  const params = new URLSearchParams({
    type: options.type,
    q: options.query,
    limit: String(OPTION_LIMIT)
  });

  (options.excludeSlugs ?? []).forEach((slug) => params.append("exclude", slug));

  const response = await fetch(`/api/tags/search?${params.toString()}`, {
    credentials: "same-origin",
    cache: "no-store"
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as { items?: TagOption[] };
  return data.items ?? [];
}

export function TagAutocomplete({
  label,
  idName,
  newName,
  tagType,
  initialSelectedTags = [],
  multiple = true,
  required = false,
  placeholder
}: TagAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<SelectedTag[]>(
    multiple
      ? initialSelectedTags.map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug }))
      : initialSelectedTags.slice(0, 1).map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug }))
  );
  const [options, setOptions] = useState<TagOption[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initialTags = initialSelectedTags.map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug }));
    setSelectedTags(multiple ? initialTags : initialTags.slice(0, 1));
  }, [initialSelectedTags, multiple]);

  const selectedSlugs = useMemo(
    () => selectedTags.map((tag) => tag.slug).filter((slug): slug is string => Boolean(slug)),
    [selectedTags]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      const nextOptions = await fetchTagSuggestions({
        type: tagType,
        query,
        excludeSlugs: selectedSlugs
      });

      if (active) {
        setOptions(nextOptions);
        setHighlightedIndex(0);
        setIsLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isOpen, query, selectedSlugs, tagType]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function addExistingTag(tag: TagOption) {
    setSelectedTags((current) => {
      const nextTag = { id: tag.id, name: tag.name, slug: tag.slug };
      if (multiple) {
        return current.some((item) => item.id === tag.id) ? current : [...current, nextTag];
      }
      return [nextTag];
    });
    setQuery("");
    setIsOpen(false);
    setHighlightedIndex(0);
  }

  function addNewTag(name: string) {
    const normalizedName = name.trim();
    if (!normalizedName) {
      return;
    }

    const existingExactTag = options.find((option) => option.name.toLowerCase() === normalizedName.toLowerCase());
    if (existingExactTag) {
      addExistingTag(existingExactTag);
      return;
    }

    setSelectedTags((current) => {
      const nextTag = { name: normalizedName, isNew: true };
      if (multiple) {
        return current.some((item) => item.name.toLowerCase() === normalizedName.toLowerCase()) ? current : [...current, nextTag];
      }
      return [nextTag];
    });
    setQuery("");
    setIsOpen(false);
    setHighlightedIndex(0);
  }

  function removeTag(indexToRemove: number) {
    setSelectedTags((current) => current.filter((_, index) => index !== indexToRemove));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((current) => Math.min(current + 1, Math.max(options.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (options[highlightedIndex] && query.trim()) {
        addExistingTag(options[highlightedIndex]);
      } else {
        addNewTag(query);
      }
      return;
    }

    if (event.key === "Backspace" && !query && selectedTags.length) {
      removeTag(selectedTags.length - 1);
    }

    if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div className="field">
      <span>{label}</span>
      <div className="tag-picker" ref={rootRef}>
        <div className="tag-chip-list">
          {selectedTags.map((tag, index) => (
            <span key={`${idName}-${tag.id ?? tag.name}-${index}`} className={tag.isNew ? "selected-tag selected-tag-new" : "selected-tag"}>
              <span>{tag.name}</span>
              <button type="button" className="selected-tag-remove" onClick={() => removeTag(index)}>
                x
              </button>
              {typeof tag.id === "number" ? <input type="hidden" name={idName} value={tag.id} /> : null}
              {tag.isNew ? <input type="hidden" name={newName} value={tag.name} /> : null}
            </span>
          ))}
          <input
            className="tag-picker-input"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={selectedTags.length && !multiple ? "" : placeholder}
            required={required && selectedTags.length === 0}
          />
        </div>

        {isOpen ? (
          <div className="tag-picker-panel">
            {isLoading ? (
              <div className="tag-option-empty">Searching...</div>
            ) : options.length ? (
              options.map((option, index) => (
                <button
                  key={`${idName}-${option.id}`}
                  type="button"
                  className={index === highlightedIndex ? "tag-option active" : "tag-option"}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => addExistingTag(option)}
                >
                  <span>{option.name}</span>
                  <small>{option.slug}</small>
                </button>
              ))
            ) : query.trim() ? (
              <button
                type="button"
                className="tag-option active"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => addNewTag(query)}
              >
                <span>Create new tag</span>
                <small>{query.trim()}</small>
              </button>
            ) : (
              <div className="tag-option-empty">Type to search or create a new tag.</div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
