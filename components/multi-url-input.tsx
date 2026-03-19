"use client";

import { useEffect, useState, type KeyboardEvent } from "react";

type MultiUrlInputProps = {
  label: string;
  name: string;
  placeholder: string;
  initialUrls?: string[];
};

export function MultiUrlInput({ label, name, placeholder, initialUrls = [] }: MultiUrlInputProps) {
  const [value, setValue] = useState("");
  const [urls, setUrls] = useState<string[]>(initialUrls);
  const [error, setError] = useState("");

  useEffect(() => {
    setUrls(initialUrls);
  }, [initialUrls]);

  useEffect(() => {
    function handleExternalLink(event: Event) {
      const customEvent = event as CustomEvent<{ url?: string }>;
      const next = customEvent.detail?.url?.trim();
      if (!next) {
        return;
      }

      try {
        new URL(next);
      } catch {
        return;
      }

      setUrls((current) => (current.includes(next) ? current : [...current, next]));
      setError("");
    }

    window.addEventListener("kkd:add-download-link", handleExternalLink as EventListener);
    return () => {
      window.removeEventListener("kkd:add-download-link", handleExternalLink as EventListener);
    };
  }, []);

  function tryAddUrl(raw: string) {
    const next = raw.trim();
    if (!next) {
      return;
    }

    try {
      new URL(next);
    } catch {
      setError("Please enter a valid URL");
      return;
    }

    setUrls((current) => (current.includes(next) ? current : [...current, next]));
    setValue("");
    setError("");
  }

  function removeUrl(indexToRemove: number) {
    setUrls((current) => current.filter((_, index) => index !== indexToRemove));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      tryAddUrl(value);
    }
  }

  return (
    <div className="field">
      <span>{label}</span>
      <div className="tag-chip-list">
        {urls.map((url, index) => (
          <span key={`${name}-${url}-${index}`} className="selected-tag selected-tag-link">
            <span>{url}</span>
            <button type="button" className="selected-tag-remove" onClick={() => removeUrl(index)}>
              x
            </button>
            <input type="hidden" name={name} value={url} />
          </span>
        ))}
        <input
          className="tag-picker-input"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) {
              setError("");
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
      </div>
      {error ? <div className="notice">{error}</div> : null}
    </div>
  );
}
