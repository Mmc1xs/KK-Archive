"use client";

import { useState } from "react";

type DemoTabItem = {
  href: string;
  title: string;
};

type OpenDemoTabsLauncherButtonProps = {
  items: DemoTabItem[];
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function OpenDemoTabsLauncherButton({ items }: OpenDemoTabsLauncherButtonProps) {
  const [error, setError] = useState("");
  const uniqueItems = items.filter((item, index, source) => source.findIndex((candidate) => candidate.href === item.href) === index);

  function renderLauncherPage(blockedCount: number) {
    const summary = blockedCount
      ? `Opened ${uniqueItems.length - blockedCount} tab(s). ${blockedCount} tab(s) were blocked by the browser.`
      : `Opened ${uniqueItems.length} demo tab(s).`;

    const links = uniqueItems
      .map(
        (item, index) =>
          `<li style="margin:10px 0;"><a href="${escapeHtml(item.href)}" target="_blank" rel="noreferrer" style="color:#1177cc;text-decoration:none;">${index + 1}. ${escapeHtml(item.title)}</a></li>`
      )
      .join("");

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Demo Tab Launcher</title>
    <style>
      body{font-family:Segoe UI,Arial,sans-serif;background:#f6fbff;color:#19324d;padding:24px;line-height:1.5}
      .panel{max-width:760px;margin:0 auto;background:#fff;border:1px solid #c8def4;border-radius:20px;padding:24px;box-shadow:0 12px 32px rgba(80,140,200,.12)}
      h1{margin:0 0 12px;font-size:32px}
      p{margin:10px 0}
      ul{padding-left:20px;margin:18px 0 0}
    </style>
  </head>
  <body>
    <div class="panel">
      <p style="letter-spacing:.18em;text-transform:uppercase;font-size:.8rem;color:#2c78c6;margin:0 0 8px;">Admin Only</p>
      <h1>Demo Tabs Launcher</h1>
      <p>${escapeHtml(summary)}</p>
      <p>If your browser blocks part of the batch, use the links below to open the remaining demo pages.</p>
      <ul>${links}</ul>
    </div>
  </body>
</html>`;
  }

  function handleOpenTabs() {
    setError("");

    const launcher = window.open("", "_blank");
    if (!launcher) {
      setError("Browser popup blocking prevented the demo tab launcher. Allow popups for this site and try again.");
      return;
    }

    let blockedCount = 0;

    uniqueItems.forEach((item, index) => {
      const absoluteHref = new URL(item.href, window.location.origin).toString();
      const openedWindow = index === 0 ? launcher : window.open(absoluteHref, "_blank");

      if (!openedWindow) {
        blockedCount += 1;
        return;
      }

      if (index === 0) {
        openedWindow.location.href = absoluteHref;
      }
    });

    try {
      if (!launcher.closed && blockedCount > 0) {
        launcher.document.open();
        launcher.document.write(renderLauncherPage(blockedCount));
        launcher.document.close();
      }
    } catch {
      // Ignore launcher write failures after the first tab navigates away.
    }

    if (blockedCount > 0) {
      setError(`The browser blocked ${blockedCount} tab(s). Allow multiple popups for this site to open the full batch.`);
    }
  }

  return (
    <div className="inline-actions">
      <button type="button" className="button secondary" disabled={!uniqueItems.length} onClick={handleOpenTabs}>
        {`Open ${uniqueItems.length} Demo Tabs`}
      </button>
      {error ? <small className="notice error">{error}</small> : null}
    </div>
  );
}
