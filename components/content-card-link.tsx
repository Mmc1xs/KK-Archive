"use client";

import Link from "next/link";
import { useState, type MouseEvent, type ReactNode } from "react";
import { type UiLocale } from "@/lib/ui-locale";
import styles from "./content-navigation-feedback.module.css";

type ContentCardLinkProps = {
  href: string;
  locale: UiLocale;
  children: ReactNode;
};

const pendingLabels: Record<UiLocale, string> = {
  en: "Opening...",
  "zh-CN": "\u6b63\u5728\u6253\u5f00...",
  ja: "\u958b\u3044\u3066\u3044\u307e\u3059..."
};

function shouldTriggerPendingState(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.button === 0 &&
    !event.defaultPrevented &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function ContentCardLink({ href, locale, children }: ContentCardLinkProps) {
  const [isPending, setIsPending] = useState(false);

  return (
    <Link
      href={href}
      prefetch={false}
      className={`card ${styles.contentCardLink}${isPending ? ` ${styles.pending}` : ""}`}
      style={{ display: "block", height: "100%" }}
      aria-busy={isPending}
      onClick={(event) => {
        if (shouldTriggerPendingState(event)) {
          setIsPending(true);
        }
      }}
    >
      {children}
      <span
        className={`${styles.pendingIndicator}${isPending ? ` ${styles.pendingIndicatorVisible}` : ""}`}
        aria-hidden="true"
      >
        <span className={styles.spinner} />
        {pendingLabels[locale]}
      </span>
    </Link>
  );
}
