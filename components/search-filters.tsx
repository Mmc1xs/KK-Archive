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
  initialWork?: SearchTagOption | null;
  initialCharacter?: SearchTagOption | null;
  initialStyles: SearchTagOption[];
  initialUsages: SearchTagOption[];
  initialTypes: string[];
  labels?: SearchFiltersLabels;
  clearHref?: string;
};

export type SearchFiltersLabels = {
  author: string;
  work: string;
  character: string;
  type: string;
  style: string;
  usage: string;
  searchAuthorPlaceholder: string;
  searchWorkPlaceholder: string;
  searchCharacterPlaceholder: string;
  selectWorkFirstPlaceholder: string;
  clear: string;
  searching: string;
  noMatchingAuthors: string;
  noMatchingWorks: string;
  selectWorkFirst: string;
  noMatchingCharacters: string;
  styleLabelTemplate: string;
  noStyleSelected: string;
  searchStylePlaceholder: string;
  maximumStyleTags: string;
  noMatchingStyles: string;
  noUsageSelected: string;
  searchUsagePlaceholder: string;
  noMatchingUsages: string;
  applyFilters: string;
  clearFilters: string;
  unknownAuthor: string;
  unknownWork: string;
  unknownCharacter: string;
};

type SearchableTagType = "AUTHOR" | "WORK" | "CHARACTER" | "STYLE" | "USAGE";

const MAX_SELECTED_STYLES = 8;
const SUGGESTION_LIMIT = 12;
const SEARCH_DEBOUNCE_MS = 180;

const defaultLabels: SearchFiltersLabels = {
  author: "Author",
  work: "Work",
  character: "Character",
  type: "Type",
  style: "Style",
  usage: "Usage",
  searchAuthorPlaceholder: "Search author",
  searchWorkPlaceholder: "Search work",
  searchCharacterPlaceholder: "Search character",
  selectWorkFirstPlaceholder: "Select work first",
  clear: "Clear",
  searching: "Searching...",
  noMatchingAuthors: "No matching authors.",
  noMatchingWorks: "No matching works.",
  selectWorkFirst: "Select a work first.",
  noMatchingCharacters: "No matching characters.",
  styleLabelTemplate: "Style ({count}/{max})",
  noStyleSelected: "No style selected.",
  searchStylePlaceholder: "Search style",
  maximumStyleTags: "Maximum {count} style tags",
  noMatchingStyles: "No matching styles.",
  noUsageSelected: "No usage selected.",
  searchUsagePlaceholder: "Search usage",
  noMatchingUsages: "No matching usages.",
  applyFilters: "Apply Filters",
  clearFilters: "Clear",
  unknownAuthor: "Unknown author",
  unknownWork: "Unknown work",
  unknownCharacter: "Unknown character"
};

async function fetchTagSuggestions(options: {
  type: SearchableTagType;
  query: string;
  excludeSlugs?: string[];
  workId?: number;
}) {
  const params = new URLSearchParams({
    type: options.type,
    q: options.query,
    limit: String(SUGGESTION_LIMIT)
  });

  (options.excludeSlugs ?? []).forEach((slug) => params.append("exclude", slug));
  if (options.type === "CHARACTER" && options.workId) {
    params.set("workId", String(options.workId));
  }

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
  initialWork = null,
  initialCharacter = null,
  initialStyles,
  initialUsages,
  initialTypes,
  labels = defaultLabels,
  clearHref = "/search"
}: SearchFiltersProps) {
  const [selectedAuthor, setSelectedAuthor] = useState<SearchTagOption | null>(initialAuthor);
  const [authorQuery, setAuthorQuery] = useState(initialAuthor?.name ?? "");
  const [authorOptions, setAuthorOptions] = useState<SearchTagOption[]>([]);
  const [authorOpen, setAuthorOpen] = useState(false);
  const [authorLoading, setAuthorLoading] = useState(false);
  const [authorHighlight, setAuthorHighlight] = useState(0);

  const [selectedWork, setSelectedWork] = useState<SearchTagOption | null>(initialWork);
  const [workQuery, setWorkQuery] = useState(initialWork?.name ?? "");
  const [workOptions, setWorkOptions] = useState<SearchTagOption[]>([]);
  const [workOpen, setWorkOpen] = useState(false);
  const [workLoading, setWorkLoading] = useState(false);
  const [workHighlight, setWorkHighlight] = useState(0);

  const [selectedCharacter, setSelectedCharacter] = useState<SearchTagOption | null>(initialCharacter);
  const [characterQuery, setCharacterQuery] = useState(initialCharacter?.name ?? "");
  const [characterOptions, setCharacterOptions] = useState<SearchTagOption[]>([]);
  const [characterOpen, setCharacterOpen] = useState(false);
  const [characterLoading, setCharacterLoading] = useState(false);
  const [characterHighlight, setCharacterHighlight] = useState(0);

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
  const workRef = useRef<HTMLDivElement>(null);
  const characterRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const usageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const styleKey = initialStyles.map((item) => item.slug).sort().join("|");
    const usageKey = initialUsages.map((item) => item.slug).sort().join("|");
    setSelectedAuthor(initialAuthor);
    setAuthorQuery(initialAuthor?.name ?? "");
    setSelectedWork(initialWork);
    setWorkQuery(initialWork?.name ?? "");
    setSelectedCharacter(initialCharacter);
    setCharacterQuery(initialCharacter?.name ?? "");
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
    initialWork?.id,
    initialWork?.slug,
    initialWork?.name,
    initialCharacter?.id,
    initialCharacter?.slug,
    initialCharacter?.name,
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
      if (!workRef.current?.contains(node)) {
        setWorkOpen(false);
      }
      if (!characterRef.current?.contains(node)) {
        setCharacterOpen(false);
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
    if (!workOpen) {
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setWorkLoading(true);
      const items = await fetchTagSuggestions({
        type: "WORK",
        query: workQuery
      });
      if (active) {
        setWorkOptions(items);
        setWorkHighlight(0);
        setWorkLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [workOpen, workQuery]);

  useEffect(() => {
    if (!characterOpen) {
      return;
    }

    if (!selectedWork) {
      setCharacterOptions([]);
      setCharacterHighlight(0);
      setCharacterLoading(false);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setCharacterLoading(true);
      const items = await fetchTagSuggestions({
        type: "CHARACTER",
        query: characterQuery,
        workId: selectedWork.id
      });
      if (active) {
        setCharacterOptions(items);
        setCharacterHighlight(0);
        setCharacterLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [characterOpen, characterQuery, selectedWork]);

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

  function selectWork(option: SearchTagOption) {
    setSelectedWork(option);
    setWorkQuery(option.name);
    setWorkOpen(false);
    setSelectedCharacter(null);
    setCharacterQuery("");
    setCharacterOptions([]);
    setCharacterHighlight(0);
  }

  function clearWork() {
    setSelectedWork(null);
    setWorkQuery("");
    setWorkOpen(false);
    setWorkHighlight(0);
    setSelectedCharacter(null);
    setCharacterQuery("");
    setCharacterOptions([]);
    setCharacterOpen(false);
    setCharacterHighlight(0);
  }

  function handleWorkKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!workOptions.length) {
      if (event.key === "Escape") {
        setWorkOpen(false);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setWorkOpen(true);
      setWorkHighlight((current) => Math.min(current + 1, workOptions.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setWorkHighlight((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter" && workOpen) {
      event.preventDefault();
      const option = workOptions[workHighlight];
      if (option) {
        selectWork(option);
      }
      return;
    }

    if (event.key === "Escape") {
      setWorkOpen(false);
    }
  }

  function selectCharacter(option: SearchTagOption) {
    setSelectedCharacter(option);
    setCharacterQuery(option.name);
    setCharacterOpen(false);
  }

  function clearCharacter() {
    setSelectedCharacter(null);
    setCharacterQuery("");
    setCharacterOpen(false);
    setCharacterHighlight(0);
  }

  function handleCharacterKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!characterOptions.length) {
      if (event.key === "Escape") {
        setCharacterOpen(false);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCharacterOpen(true);
      setCharacterHighlight((current) => Math.min(current + 1, characterOptions.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCharacterHighlight((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter" && characterOpen) {
      event.preventDefault();
      const option = characterOptions[characterHighlight];
      if (option) {
        selectCharacter(option);
      }
      return;
    }

    if (event.key === "Escape") {
      setCharacterOpen(false);
    }
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

  const styleLabel = labels.styleLabelTemplate
    .replace("{count}", String(selectedStyles.length))
    .replace("{max}", String(MAX_SELECTED_STYLES));

  return (
    <form method="get" className="grid">
      <div className="field">
        <label htmlFor="author-search">{labels.author}</label>
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
              placeholder={labels.searchAuthorPlaceholder}
              autoComplete="off"
            />
            {selectedAuthor ? (
              <button type="button" className="search-inline-clear" onClick={clearAuthor}>
                {labels.clear}
              </button>
            ) : null}
          </div>

          {selectedAuthor ? <input type="hidden" name="author" value={selectedAuthor.slug} /> : null}

          {authorOpen ? (
            <div className="search-author-panel">
              {authorLoading ? (
                <div className="search-author-empty">{labels.searching}</div>
              ) : authorOptions.length ? (
                authorOptions.map((author, index) => (
                  <button
                    key={`author-${author.id}`}
                    type="button"
                    className={index === authorHighlight ? "search-author-option active" : "search-author-option"}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectAuthor(author)}
                  >
                    <span className="search-author-label">{author.name || labels.unknownAuthor}</span>
                  </button>
                ))
              ) : (
                <div className="search-author-empty">{labels.noMatchingAuthors}</div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="field">
        <label htmlFor="work-search">{labels.work}</label>
        <div className="search-author-picker" ref={workRef}>
          <div className="search-author-input-wrap">
            <input
              id="work-search"
              type="text"
              value={workQuery}
              onChange={(event) => {
                const nextQuery = event.target.value;
                setWorkQuery(nextQuery);
                setWorkOpen(true);
                if (selectedWork && nextQuery !== selectedWork.name) {
                  setSelectedWork(null);
                  setSelectedCharacter(null);
                  setCharacterQuery("");
                }
              }}
              onFocus={() => setWorkOpen(true)}
              onKeyDown={handleWorkKeyDown}
              placeholder={labels.searchWorkPlaceholder}
              autoComplete="off"
            />
            {selectedWork ? (
              <button type="button" className="search-inline-clear" onClick={clearWork}>
                {labels.clear}
              </button>
            ) : null}
          </div>

          {selectedWork ? <input type="hidden" name="work" value={selectedWork.slug} /> : null}

          {workOpen ? (
            <div className="search-author-panel">
              {workLoading ? (
                <div className="search-author-empty">{labels.searching}</div>
              ) : workOptions.length ? (
                workOptions.map((work, index) => (
                  <button
                    key={`work-${work.id}`}
                    type="button"
                    className={index === workHighlight ? "search-author-option active" : "search-author-option"}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectWork(work)}
                  >
                    <span className="search-author-label">{work.name || labels.unknownWork}</span>
                  </button>
                ))
              ) : (
                <div className="search-author-empty">{labels.noMatchingWorks}</div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="field">
        <label htmlFor="character-search">{labels.character}</label>
        <div className="search-author-picker" ref={characterRef}>
          <div className="search-author-input-wrap">
            <input
              id="character-search"
              type="text"
              value={characterQuery}
              onChange={(event) => {
                const nextQuery = event.target.value;
                setCharacterQuery(nextQuery);
                setCharacterOpen(true);
                if (selectedCharacter && nextQuery !== selectedCharacter.name) {
                  setSelectedCharacter(null);
                }
              }}
              onFocus={() => setCharacterOpen(true)}
              onKeyDown={handleCharacterKeyDown}
              placeholder={selectedWork ? labels.searchCharacterPlaceholder : labels.selectWorkFirstPlaceholder}
              autoComplete="off"
              disabled={!selectedWork}
            />
            {selectedCharacter ? (
              <button type="button" className="search-inline-clear" onClick={clearCharacter}>
                {labels.clear}
              </button>
            ) : null}
          </div>

          {selectedCharacter ? <input type="hidden" name="character" value={selectedCharacter.slug} /> : null}

          {characterOpen ? (
            <div className="search-author-panel">
              {!selectedWork ? (
                <div className="search-author-empty">{labels.selectWorkFirst}</div>
              ) : characterLoading ? (
                <div className="search-author-empty">{labels.searching}</div>
              ) : characterOptions.length ? (
                characterOptions.map((character, index) => (
                  <button
                    key={`character-${character.id}`}
                    type="button"
                    className={
                      index === characterHighlight ? "search-author-option active" : "search-author-option"
                    }
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectCharacter(character)}
                  >
                    <span className="search-author-label">{character.name || labels.unknownCharacter}</span>
                  </button>
                ))
              ) : (
                <div className="search-author-empty">{labels.noMatchingCharacters}</div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <SearchToggleGroup
        label={labels.type}
        name="types"
        options={types}
        selected={selectedTypes}
        onToggle={(slug) => setSelectedTypes((current) => toggleSelection(current, slug))}
      />

      <div className="field">
        <label htmlFor="style-search">{styleLabel}</label>
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
          <small className="filter-helper-text">{labels.noStyleSelected}</small>
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
              placeholder={labels.searchStylePlaceholder}
              autoComplete="off"
            />
          </div>

          {styleOpen ? (
            <div className="search-author-panel">
              {styleLoading ? (
                <div className="search-author-empty">{labels.searching}</div>
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
                        ? labels.maximumStyleTags.replace("{count}", String(MAX_SELECTED_STYLES))
                        : undefined
                    }
                  >
                    <span className="search-author-label">{option.name}</span>
                  </button>
                ))
              ) : (
                <div className="search-author-empty">{labels.noMatchingStyles}</div>
              )}
            </div>
          ) : null}
        </div>

        {selectedStyles.map((item) => (
          <input key={`styles-${item.slug}`} type="hidden" name="styles" value={item.slug} />
        ))}
      </div>

      <div className="field">
        <label htmlFor="usage-search">{labels.usage}</label>
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
          <small className="filter-helper-text">{labels.noUsageSelected}</small>
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
              placeholder={labels.searchUsagePlaceholder}
              autoComplete="off"
            />
          </div>

          {usageOpen ? (
            <div className="search-author-panel">
              {usageLoading ? (
                <div className="search-author-empty">{labels.searching}</div>
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
                <div className="search-author-empty">{labels.noMatchingUsages}</div>
              )}
            </div>
          ) : null}
        </div>

        {selectedUsages.map((item) => (
          <input key={`usages-${item.slug}`} type="hidden" name="usages" value={item.slug} />
        ))}
      </div>

      <div className="inline-actions">
        <button type="submit">{labels.applyFilters}</button>
        <a href={clearHref} className="link-pill">
          {labels.clearFilters}
        </a>
      </div>
    </form>
  );
}
