import type { Metadata } from "next";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { getRankNames, RANK_TIERS } from "@/lib/ranks";
import RankBadge from "@/components/RankBadge";
import styles from "./RulesPage.module.css";

export const metadata: Metadata = {
  title: "Rules",
  description: "Learn how ranked Rock-Paper-Scissors matches, scoring, and rank tiers work in Ranked RPS Online.",
};

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
            <li>Rock beats Scissors, Scissors beats Paper, Paper beats Rock.</li>
            <li>Matches are first to 4 round wins.</li>
            <li>If you don&apos;t submit a choice before the round timer runs out, you forfeit that round.</li>
            <li>Ranked and Async games track separate ratings — climbing one doesn&apos;t affect the other.</li>
          </ol>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Game Modes</h2>
          <dl className={styles.modesList}>
            <div className={styles.modeItem}>
              <dt className={styles.modeName}>Ranked</dt>
              <dd className={styles.modeDesc}>
                Real-time, head-to-head matches. You and your opponent are both online at once, so keep
                the tab open — you have 30 seconds to make each choice. One ranked match at a time.
              </dd>
            </div>
            <div className={styles.modeItem}>
              <dt className={styles.modeName}>Async</dt>
              <dd className={styles.modeDesc}>
                Play at your own pace. You have up to 24 hours to respond each round, and you can have
                several async games going at once — check in whenever it&apos;s convenient. A round resolves
                automatically once both players have chosen, or when the timer runs out.
              </dd>
            </div>
            <div className={styles.modeItem}>
              <dt className={styles.modeName}>vs AI</dt>
              <dd className={styles.modeDesc}>
                Practice against a bot opponent. No rating is at stake, so it&apos;s a good place to warm up.
              </dd>
            </div>
          </dl>
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
                {getRankNames().map((rankName) => {
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