"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SESSION_PRESENCE_COOKIE_NAME } from "@/lib/constants";
import { type UiLocale } from "@/lib/ui-locale";

type SessionUser = {
  role: "ADMIN" | "AUDIT" | "MEMBER";
};

type ContentDetailSessionActionsProps = {
  contentId: number;
  reviewStatus: string;
  locale: UiLocale;
  placement: "admin" | "status";
  editLabel?: string;
  reviewStatusLabel?: string;
  reviewStatusClassName?: string;
};

const REPORT_ISSUE_THREAD_HREF = "https://t.me/c/4331026715/7/8";
let sessionPromise: Promise<SessionUser | null> | null = null;

function getReportCopy(locale: UiLocale) {
  switch (locale) {
    case "zh-CN":
      return {
        label: "回报问题",
        hoverHint: "前往 KK Archive Telegram 问题回报讨论串。"
      };
    case "ja":
      return {
        label: "問題を報告",
        hoverHint: "KK Archive Telegram の問題報告スレッドを開きます。"
      };
    default:
      return {
        label: "Report Issue",
        hoverHint: "Open the KK Archive Telegram issue report thread."
      };
  }
}

function hasSessionPresenceCookie() {
  try {
    return document.cookie
      .split(";")
      .map((part) => part.trim().split("=")[0])
      .includes(SESSION_PRESENCE_COOKIE_NAME);
  } catch {
    return false;
  }
}

async function loadSessionSnapshot() {
  if (!sessionPromise) {
    sessionPromise = fetch("/api/session", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store"
    })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        const data = (await response.json()) as { user?: SessionUser | null };
        return data.user ?? null;
      })
      .catch(() => null);
  }

  return sessionPromise;
}

export function ContentDetailSessionActions({
  contentId,
  reviewStatus,
  locale,
  placement,
  editLabel,
  reviewStatusLabel,
  reviewStatusClassName
}: ContentDetailSessionActionsProps) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const reportCopy = getReportCopy(locale);
  const isStaff = user?.role === "ADMIN" || user?.role === "AUDIT";
  const canReportIssue = Boolean(user) && reviewStatus === "PASSED";

  useEffect(() => {
    if (!hasSessionPresenceCookie()) {
      return;
    }

    let active = true;

    async function resolveSession() {
      const nextUser = await loadSessionSnapshot();
      if (active) {
        setUser(nextUser);
      }
    }

    void resolveSession();

    return () => {
      active = false;
    };
  }, []);

  if (!isStaff && !canReportIssue) {
    return null;
  }

  if (placement === "admin") {
    if (!isStaff || !editLabel) {
      return null;
    }

    return (
      <div className="admin-detail-actions">
        <Link href={`/admin/contents/${contentId}/edit`} className="link-pill admin-edit-link" prefetch={false}>
          {editLabel}
        </Link>
      </div>
    );
  }

  return (
    <>
      {isStaff && reviewStatusLabel && reviewStatusClassName ? (
        <div className={reviewStatusClassName}>{reviewStatusLabel}</div>
      ) : null}
      {canReportIssue ? (
        <a href={REPORT_ISSUE_THREAD_HREF} target="_blank" rel="noreferrer" className="link-pill" title={reportCopy.hoverHint}>
          {reportCopy.label}
        </a>
      ) : null}
    </>
  );
}
