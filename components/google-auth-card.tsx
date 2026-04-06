import type { ReactNode } from "react";

type GoogleAuthCardProps = {
  eyebrow?: string;
  title: string;
  description: string;
  actionLabel: string;
  error?: string;
  footer?: ReactNode;
  helperText?: string;
};

export function GoogleAuthCard({
  eyebrow = "Member Access",
  title,
  description,
  actionLabel,
  error,
  footer,
  helperText = "Only Google-verified accounts can sign in. The first successful Google login will create or link your member account automatically."
}: GoogleAuthCardProps) {
  return (
    <>
      <section className="page-section panel" style={{ maxWidth: 520, marginInline: "auto" }}>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="title-lg">{title}</h1>
        <p className="muted">{description}</p>
        {error ? <div className="notice">{error}</div> : null}
        <div className="grid" style={{ marginTop: 20 }}>
          <a href="/auth/google" className="button google-auth-button">
            {actionLabel}
          </a>
          <p className="muted">{helperText}</p>
        </div>
      </section>
      {footer}
    </>
  );
}
