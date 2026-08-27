import styles from "@/app/page.module.css";

export default function MatchesGridSkeleton() {
  return (
    <div className={styles.matchesGrid} aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className={styles.skeletonCard}>
          <div className={styles.skeletonRow}>
            <span className={`${styles.skeletonBlock} ${styles.skeletonTime}`} />
            <span className={`${styles.skeletonBlock} ${styles.skeletonBadge}`} />
          </div>
          <div className={styles.skeletonRow}>
            <span className={`${styles.skeletonBlock} ${styles.skeletonPlayer}`} />
            <span className={`${styles.skeletonBlock} ${styles.skeletonScore}`} />
            <span className={`${styles.skeletonBlock} ${styles.skeletonPlayer}`} />
          </div>
          <span className={`${styles.skeletonBlock} ${styles.skeletonWinner}`} />
        </div>
      ))}
    </div>
  );
}
