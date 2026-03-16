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

type TagAutocompleteProps = {
  label: string;
  idName: string;
  newName: string;
  options: TagOption[];
  initialSelectedIds?: number[];
  multiple?: boolean;
  required?: boolean;
  placeholder: string;
};

export function TagAutocomplete({
  label,
  idName,
  newName,
  options,
  initialSelectedIds = [],
  multiple = true,
  required = false,
  placeholder
}: TagAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<SelectedTag[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initialTags = initialSelectedIds
      .map((id) => options.find((option) => option.id === id))
      .filter(Boolean)
      .map((tag) => ({ id: tag!.id, name: tag!.name, slug: tag!.slug }));

    setSelectedTags(multiple ? initialTags : initialTags.slice(0, 1));
  }, [initialSelectedIds, multiple, options]);

  const selectedIds = useMemo(
    () => selectedTags.map((tag) => tag.id).filter((id): id is number => typeof id === "number"),
    [selectedTags]
  );

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return options.filter((option) => {
      if (selectedIds.includes(option.id)) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return option.name.toLowerCase().includes(normalized) || option.slug.toLowerCase().includes(normalized);
    });
  }, [options, query, selectedIds]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

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
      setHighlightedIndex((current) => Math.min(current + 1, Math.max(filteredOptions.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (filteredOptions[highlightedIndex] && query.trim()) {
        addExistingTag(filteredOptions[highlightedIndex]);
      } else {
        addNewTag(query);
      }
      return;
    }

    if (event.key === "Backspace" && !query && selectedTags.length) {
      removeTag(selectedTags.length - 1);
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
            {filteredOptions.length ? (
              filteredOptions.slice(0, 8).map((option, index) => (
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
