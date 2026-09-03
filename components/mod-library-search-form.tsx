"use client";

import Link from "next/link";
import { useRef } from "react";

type ModLibrarySearchFormProps = {
  action: string;
  query: string;
  pageSize: number;
  searchLabel: string;
  searchPlaceholder: string;
  searchButton: string;
  clearButton: string;
};

const MOD_LIBRARY_SEARCH_COUNT_KEY = "kk_mod_library_search_count";
const MOD_LIBRARY_SEARCH_AD_INTERVAL = Math.max(
  1,
  Number.parseInt(process.env.NEXT_PUBLIC_EXOCLICK_MOD_LIBRARY_SEARCH_TRIGGER_INTERVAL?.trim() || "5", 10) || 5
);
const MOD_LIBRARY_SEARCH_TRIGGER_CLASS =
  process.env.NEXT_PUBLIC_EXOCLICK_MOD_LIBRARY_SEARCH_TRIGGER_CLASS?.trim() || "exo-mod-library-search-trigger";

function shouldTriggerModLibrarySearchAd() {
  try {
    const rawCount = window.localStorage.getItem(MOD_LIBRARY_SEARCH_COUNT_KEY);
    const currentSearchCount = rawCount ? Number.parseInt(rawCount, 10) : 0;
    const nextSearchCount = (Number.isFinite(currentSearchCount) ? currentSearchCount : 0) + 1;

    window.localStorage.setItem(MOD_LIBRARY_SEARCH_COUNT_KEY, String(nextSearchCount));

    return nextSearchCount === 1 || nextSearchCount % MOD_LIBRARY_SEARCH_AD_INTERVAL === 0;
  } catch {
    return true;
  }
}

export function ModLibrarySearchForm({
  action,
  query,
  pageSize,
  searchLabel,
  searchPlaceholder,
  searchButton,
  clearButton
}: ModLibrarySearchFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitTimerRef = useRef<number | null>(null);

  function submitSearch(delayMs: number) {
    if (submitTimerRef.current) {
      window.clearTimeout(submitTimerRef.current);
    }

    submitTimerRef.current = window.setTimeout(() => {
      formRef.current?.requestSubmit();
    }, delayMs);
  }

  function handleSearchClickCapture(event: React.MouseEvent<HTMLButtonElement>) {
    if (shouldTriggerModLibrarySearchAd()) {
      submitSearch(150);
      return;
    }

    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    submitSearch(0);
  }

  return (
    <form ref={formRef} action={action} method="get" className="inline-actions mod-library-search-form">
      <label className="field-label mod-library-search-label">
        {searchLabel}
        <input name="q" type="text" defaultValue={query} placeholder={searchPlaceholder} />
      </label>
      <input type="hidden" name="pageSize" value={String(pageSize)} />
      <button
        type="button"
        className={`button secondary ${MOD_LIBRARY_SEARCH_TRIGGER_CLASS}`}
        onClickCapture={handleSearchClickCapture}
      >
        {searchButton}
      </button>
      <Link href={action} className="link-pill">
        {clearButton}
      </Link>
    </form>
  );
}
