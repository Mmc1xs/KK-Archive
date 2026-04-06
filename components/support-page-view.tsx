import Link from "next/link";

type SupportPageViewProps = {
  titleEyebrow: string;
  title: string;
  paragraphs: [string, string, string];
  supportLabel: string;
  backLabel: string;
  backHref: string;
  paymentUrl: string;
};

export function SupportPageView({
  titleEyebrow,
  title,
  paragraphs,
  supportLabel,
  backLabel,
  backHref,
  paymentUrl
}: SupportPageViewProps) {
  return (
    <section className="page-section support-page">
      <div className="panel support-panel">
        <p className="eyebrow">{titleEyebrow}</p>
        <h1 className="title-lg">{title}</h1>
        {paragraphs.map((paragraph) => (
          <p key={paragraph} className="muted">
            {paragraph}
          </p>
        ))}
        <div className="inline-actions">
          <a className="button" href={paymentUrl} target="_blank" rel="noreferrer noopener">
            {supportLabel}
          </a>
          <Link className="link-pill" href={backHref}>
            {backLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}

type LegalSection = {
  title: string;
  body: string;
};

type LegalPageViewProps = {
  eyebrow: string;
  title: string;
  sections: LegalSection[];
};

export function LegalPageView({ eyebrow, title, sections }: LegalPageViewProps) {
  return (
    <section className="page-section panel legal-page">
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="title-lg">{title}</h1>

      <div className="grid">
        {sections.map((section) => (
          <section key={section.title} className="tag-section">
            <strong>{section.title}</strong>
            <p className="muted">{section.body}</p>
          </section>
        ))}
      </div>
    </section>
  );
}
