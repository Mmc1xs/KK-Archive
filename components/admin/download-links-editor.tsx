"use client";

import { useEffect, useState } from "react";

type DownloadLinksEditorProps = {
  initialTelegramLink?: string;
  initialHostedLinks?: string[];
};

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function DownloadLinksEditor({
  initialTelegramLink = "",
  initialHostedLinks = []
}: DownloadLinksEditorProps) {
  const [telegramLink, setTelegramLink] = useState(initialTelegramLink);
  const [hostedLinks, setHostedLinks] = useState<string[]>([...new Set(initialHostedLinks)]);
  const [error, setError] = useState("");

  useEffect(() => {
    setTelegramLink(initialTelegramLink);
  }, [initialTelegramLink]);

  useEffect(() => {
    setHostedLinks([...new Set(initialHostedLinks)]);
  }, [initialHostedLinks]);

  useEffect(() => {
    function handleExternalLink(event: Event) {
      const customEvent = event as CustomEvent<{ url?: string }>;
      const next = customEvent.detail?.url?.trim();
      if (!next) {
        return;
      }
      setHostedLinks((current) => (current.includes(next) ? current : [...current, next]));
    }

    function handleRemovedLink(event: Event) {
      const customEvent = event as CustomEvent<{ url?: string }>;
      const removed = customEvent.detail?.url?.trim();
      if (!removed) {
        return;
      }

      setHostedLinks((current) => current.filter((item) => item !== removed));
    }

    window.addEventListener("kkd:add-download-link", handleExternalLink as EventListener);
    window.addEventListener("kkd:remove-download-link", handleRemovedLink as EventListener);
    return () => {
      window.removeEventListener("kkd:add-download-link", handleExternalLink as EventListener);
      window.removeEventListener("kkd:remove-download-link", handleRemovedLink as EventListener);
    };
  }, []);

  const trimmedTelegram = telegramLink.trim();
  const telegramIsValid = !trimmedTelegram || isValidUrl(trimmedTelegram);

  return (
    <div className="field download-links-editor">
      <span>Download Links</span>

      <div className="download-link-row">
        <label htmlFor="telegramDownloadLink">TG</label>
        <input
          id="telegramDownloadLink"
          type="url"
          placeholder="https://t.me/your-channel/123"
          value={telegramLink}
          onChange={(event) => {
            const next = event.target.value;
            setTelegramLink(next);
            if (!next.trim() || isValidUrl(next.trim())) {
              setError("");
            } else {
              setError("Please enter a valid TG link");
            }
          }}
        />
        {trimmedTelegram && telegramIsValid ? <input type="hidden" name="downloadLinks" value={trimmedTelegram} /> : null}
      </div>

      <div className="download-link-row">
        <label>Website (R2)</label>
        <div className="download-link-readonly">
          {hostedLinks.length
            ? `Auto-linked from Hosted Files: ${hostedLinks.length} file(s)`
            : "No hosted file yet. Upload in Hosted Files and it will auto-link here."}
        </div>
        {hostedLinks.map((url, index) => (
          <input key={`hosted-download-link-${index}`} type="hidden" name="downloadLinks" value={url} />
        ))}
      </div>

      {error ? <div className="notice">{error}</div> : null}
    </div>
  );
}
