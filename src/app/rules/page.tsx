import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { RANK_TIERS, Rank } from "@/lib/ranks";
import RankBadge from "@/components/RankBadge";
import styles from "./RulesPage.module.css";

// Build one row per rank (not per tier) for the summary table
const RANK_SUMMARY: Rank[] = [
    "Recruit", "Apprentice", "Veteran", "Expert",
    "Master", "Grandmaster", "Ultimate", "Infinity",
] as const;

export default function RulesPage() {
    return (
        <div className="app">
            <Header />
            <main className={styles.main}>

                <h1 className={styles.pageTitle}>Rules</h1>

                <section className={styles.card}>
                    <h2 className={styles.sectionTitle}>Game Rules</h2>
                    <ol className={styles.rulesList}>
                        <li>Don&apos;t be stupid.</li>
                        <li>Games are first to 4 wins.</li>
                    </ol>
                </section>

                <section className={styles.card}>
                    <h2 className={styles.sectionTitle}>Rank System</h2>
                    <p className={styles.rankIntro}>
                        Your skill rating determines your rank and division. Each rank has three
                        divisions — <strong>I</strong>, <strong>II</strong>, and <strong>III</strong> —
                        where III is the highest. Reach <strong>Infinity</strong> to join the elite.
                    </p>

                    <div className={styles.tableWrapper}>
                        <table className={styles.rankTable}>
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Division I</th>
                                    <th>Division II</th>
                                    <th>Division III</th>
                                </tr>
                            </thead>
                            <tbody>
                                {RANK_SUMMARY.map((rankName) => {
                                    const tiers = RANK_TIERS.filter((t) => t.rank === rankName);
                                    const color = tiers[0]?.color ?? "#fff";
                                    const isInfinity = rankName === "Infinity";
                                    const infTier = tiers[0];

                                    return (
                                        <tr key={rankName} className={styles.rankRow}>
                                            <td>
                                                <RankBadge rating={tiers[0].minRating} variant="full" />
                                            </td>
                                            {isInfinity ? (
                                                <td colSpan={3} className={styles.infinityCell}>
                                                    <span className={styles.rainbowText}>
                                                        {infTier.minRating}+ rating
                                                    </span>
                                                </td>
                                            ) : (
                                                tiers.sort((a, b) => (a.division ?? 0) - (b.division ?? 0)).map((tier) => (
                                                    <td key={tier.division} className={styles.divisionCell}>
                                                        <span className={styles.ratingPill} style={{ "--rank-color": color } as React.CSSProperties}>
                                                            {tier.minRating}+
                                                        </span>
                                                    </td>
                                                ))
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>

            </main>
            <Footer />
        </div>
    );
}