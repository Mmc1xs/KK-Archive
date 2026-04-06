import styles from "./content-navigation-feedback.module.css";

type ContentDetailLoadingViewProps = {
  label: string;
};

export function ContentDetailLoadingView({ label }: ContentDetailLoadingViewProps) {
  return (
    <div className="page-section grid" aria-busy="true" aria-live="polite">
      <div className={styles.loadingShell}>
        <div className={styles.loadingBadge}>
          <span className={styles.spinner} />
          <span>{label}</span>
        </div>
        <div className={styles.layout}>
          <section className={`panel ${styles.panel}`}>
            <div className={styles.media} />
            <div className={styles.gallery}>
              <div className={styles.thumb} />
              <div className={styles.thumb} />
            </div>
          </section>
          <aside className={`panel ${styles.panel}`}>
            <div className={`${styles.line} ${styles.eyebrow}`} />
            <div className={`${styles.line} ${styles.title}`} />
            <div className={`${styles.line} ${styles.title} ${styles.short}`} />
            <div className={styles.statusRow}>
              <div className={styles.pill} />
              <div className={styles.pill} />
            </div>
            <div className={styles.line} />
            <div className={styles.line} />
            <div className={`${styles.line} ${styles.short}`} />
            <div className={styles.tagGrid}>
              <div className={styles.tagCard} />
              <div className={styles.tagCard} />
              <div className={styles.tagCard} />
              <div className={styles.tagCard} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
