import styles from "./profile-view.module.css";

export type ProfileMetric = {
  label: string;
  value: string;
  help: string;
  tone?: "default" | "strong";
};

export type ProfileSlot = {
  title: string;
  description: string;
};

type ProfileViewProps = {
  eyebrow: string;
  title: string;
  role: "MEMBER" | "AUDIT" | "ADMIN";
  status: string;
  identity: Array<{ label: string; value: string; actionLabel?: string; actionHref?: string }>;
  metrics?: ProfileMetric[];
  slots: ProfileSlot[];
};

export function ProfileView({ eyebrow, title, role, status, identity, metrics, slots }: ProfileViewProps) {
  const isMember = role === "MEMBER";

  return (
    <section className={`panel ${styles.previewPanel}`}>
      <div className={styles.previewHeader}>
        <div className={styles.previewHeaderCopy}>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className={styles.previewTitle}>{title}</h1>
          <div className={styles.previewMeta}>
            <span className={styles.roleBadge}>{role}</span>
            <span className={styles.statusBadge}>{status}</span>
          </div>
        </div>
        <div className={styles.identityCard}>
          <div className={styles.identityTop}>
            <strong>Profile Identity</strong>
            {isMember ? null : <small>Keep the account record clear first. Avatar and social modules can come later.</small>}
          </div>
          <dl className={styles.identityList}>
            {identity.map((item) => (
              <div key={item.label} className={styles.identityItem}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className={`${styles.previewBody} ${isMember ? styles.previewBodySingle : ""}`}>
        <div className={styles.bodyColumn}>
          <div className={styles.block}>
            <div className={styles.blockHeader}>
              <strong>Account Details</strong>
              {isMember ? null : <small>Stable identity data that every signed-in account can see.</small>}
            </div>
            <div className={styles.accountGrid}>
              {identity.map((item) => (
                <div key={item.label} className={styles.accountCard}>
                  <div className={styles.accountCardHeader}>
                    <span>{item.label}</span>
                    {item.actionLabel && item.actionHref ? (
                      <a href={item.actionHref} className="link-pill">
                        {item.actionLabel}
                      </a>
                    ) : null}
                  </div>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>

          {metrics ? (
            <div className={styles.block}>
              <div className={styles.blockHeader}>
                <strong>Staff Metrics</strong>
                <small>Role-based work numbers. Members do not see this area.</small>
              </div>
              <div className={styles.metricGrid}>
                {metrics.map((metric) => (
                  <article
                    key={metric.label}
                    className={`${styles.metricCard} ${metric.tone === "strong" ? styles.metricCardStrong : ""}`}
                  >
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                    <small>{metric.help}</small>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {isMember ? null : (
          <div className={styles.bodyColumn}>
            <div className={styles.block}>
              <div className={styles.blockHeader}>
                <strong>Extension Slots</strong>
                <small>Reserved modules for settlement, creator tools, billing, or future internal panels.</small>
              </div>
              <div className={styles.slotGrid}>
                {slots.map((slot) => (
                  <article key={slot.title} className={styles.slotCard}>
                    <span className={styles.slotBadge}>Reserved</span>
                    <strong>{slot.title}</strong>
                    <p>{slot.description}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className={styles.block}>
              <div className={styles.blockHeader}>
                <strong>Scalability Notes</strong>
                <small>This structure keeps future expansion cheap.</small>
              </div>
              <ul className={styles.noteList}>
                <li>Identity, staff metrics, and extension slots are separated, so new features do not force a full page redesign.</li>
                <li>Settlement Quantity is independent from Passed Count and can be adjusted by admin without touching moderation history.</li>
                <li>Future creator tools can plug into reserved slots instead of crowding the account core.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
