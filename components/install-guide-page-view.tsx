import Image from "next/image";
import Link from "next/link";

export type InstallGuideText =
  | string
  | Array<
      | string
      | {
          text: string;
          href: string;
        }
    >;

export type InstallGuideVersion = {
  id: string;
  code: string;
  name: string;
  tagline: string;
  iconUrl: string;
  sourceHref?: string;
  sourceLabel: string;
  pendingLabel: string;
  sourceOptions?: Array<{
    label: string;
    href?: string;
    pendingLabel: string;
    note?: string;
  }>;
  steps: InstallGuideText[];
  pluginGroups: Array<{
    title: string;
    items: InstallGuideText[];
  }>;
  checks: InstallGuideText[];
};

export type InstallGuideCopy = {
  eyebrow: string;
  title: string;
  description: string;
  backLabel: string;
  sourceTitle: string;
  setupTitle: string;
  pluginTitle: string;
  checkTitle: string;
  jumpLabel: string;
  unavailableNote: string;
  versions: InstallGuideVersion[];
};

type InstallGuidePageViewProps = {
  copy: InstallGuideCopy;
  homeHref: string;
};

function getTextKey(text: InstallGuideText) {
  return typeof text === "string" ? text : text.map((part) => (typeof part === "string" ? part : part.text)).join("");
}

function renderInstallText(text: InstallGuideText) {
  if (typeof text === "string") {
    return text;
  }

  return text.map((part, index) =>
    typeof part === "string" ? (
      part
    ) : (
      <a key={`${part.href}-${index}`} className="install-inline-link" href={part.href} target="_blank" rel="noreferrer">
        {part.text}
      </a>
    )
  );
}

export function InstallGuidePageView({ copy, homeHref }: InstallGuidePageViewProps) {
  const showVersionJump = copy.versions.length > 1;

  return (
    <main className="page-section install-guide-page">
      <section className="install-guide-hero">
        <div>
          <div className="eyebrow">{copy.eyebrow}</div>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <div className="install-guide-actions">
          <Link href={homeHref} className="link-pill">
            {copy.backLabel}
          </Link>
        </div>
      </section>

      {showVersionJump ? (
        <nav className="install-guide-jump" aria-label={copy.jumpLabel}>
          {copy.versions.map((version) => (
            <a key={`jump-${version.id}`} href={`#${version.id}`}>
              <Image src={version.iconUrl} alt="" width={56} height={56} />
              <span>{version.code}</span>
              <strong>{version.name}</strong>
            </a>
          ))}
        </nav>
      ) : null}

      <div className="install-guide-stack">
        {copy.versions.map((version) => (
          <section key={version.id} id={version.id} className="install-version-panel">
            <header className="install-version-header">
              <Image src={version.iconUrl} alt="" width={96} height={96} />
              <div>
                <div className="eyebrow">{version.code}</div>
                <h2>{version.name}</h2>
                <p>{version.tagline}</p>
              </div>
            </header>

            <div className="install-version-grid">
              <article className="install-source-card">
                <div className="eyebrow">{copy.sourceTitle}</div>
                {version.sourceOptions ? (
                  <div className="install-source-list">
                    {version.sourceOptions.map((source) => (
                      <div key={source.label} className="install-source-option">
                        {source.href ? (
                          <a className="install-source-button" href={source.href} target="_blank" rel="noreferrer">
                            {source.label}
                            <span aria-hidden="true">↗</span>
                          </a>
                        ) : (
                          <span className="install-source-button is-disabled">{source.pendingLabel}</span>
                        )}
                        {source.note ? <p>{source.note}</p> : null}
                        {!source.href && !source.note ? <p>{copy.unavailableNote}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {version.sourceHref ? (
                      <a className="install-source-button" href={version.sourceHref} target="_blank" rel="noreferrer">
                        {version.sourceLabel}
                        <span aria-hidden="true">↗</span>
                      </a>
                    ) : (
                      <span className="install-source-button is-disabled">{version.pendingLabel}</span>
                    )}
                    {!version.sourceHref ? <p>{copy.unavailableNote}</p> : null}
                  </>
                )}
              </article>

              <article className="install-steps-card">
                <div className="eyebrow">{copy.setupTitle}</div>
                <ol className="install-step-list">
                  {version.steps.map((step) => (
                    <li key={getTextKey(step)}>{renderInstallText(step)}</li>
                  ))}
                </ol>
              </article>
            </div>

            <div className="install-plugin-grid">
              <article className="install-plugin-panel">
                <div className="eyebrow">{copy.pluginTitle}</div>
                {version.pluginGroups.map((group) => (
                  <div key={group.title} className="install-plugin-group">
                    <h3>{group.title}</h3>
                    <ul>
                      {group.items.map((item) => (
                        <li key={getTextKey(item)}>{renderInstallText(item)}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </article>

              <article className="install-check-panel">
                <div className="eyebrow">{copy.checkTitle}</div>
                <ul>
                  {version.checks.map((check) => (
                    <li key={getTextKey(check)}>{renderInstallText(check)}</li>
                  ))}
                </ul>
              </article>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
