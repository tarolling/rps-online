import type { Metadata } from "next";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { getRankNames, RANK_TIERS } from "@/lib/ranks";
import RankBadge from "@/components/RankBadge";
import { GAMES_PLAYED_TITLES, INFINITY_RANK_TITLE, RARITY_COLOR, TOURNAMENT_CHAMPION_TITLE, WIN_STREAK_TITLES } from "@/lib/titles";
import styles from "./RulesPage.module.css";
import config from "@/config/settings.json";

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
            <li>Matches are first to 4 round wins.</li>
            <li>If you don&apos;t submit a choice before the round timer runs out, you forfeit that round.</li>
            <li>Blitz, Async, and Wildcard games each track separate ratings, so climbing one doesn&apos;t affect the others.</li>
          </ol>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Game Modes</h2>
          <dl className={styles.modesList}>
            <div className={styles.modeItem}>
              <dt className={styles.modeName}>Blitz</dt>
              <dd className={styles.modeDesc}>
                Real-time, head-to-head matches. You and your opponent are both online at once, so keep
                the tab open. You have 30 seconds to make each choice. One Blitz match at a time.
              </dd>
            </div>
            <div className={styles.modeItem}>
              <dt className={styles.modeName}>Async</dt>
              <dd className={styles.modeDesc}>
                Play at your own pace. You have up to 24 hours to respond each round, and you can have
                several async games going at once (up to {config.async.freeConcurrentGameLimit} for non-premium users). A round resolves
                automatically once both players have chosen, or when the timer runs out.
              </dd>
            </div>
            <div className={styles.modeItem}>
              <dt className={styles.modeName}>Wildcard</dt>
              <dd className={styles.modeDesc}>
                Real-time like Blitz, with two extra moves: A and B. Before the match starts, you secretly
                pick 2 of Rock/Paper/Scissors that your A will beat. The one you don&apos;t pick beats your A
                instead, and B beats only A. A and B tie themselves, and B always loses to Rock, Paper, and
                Scissors. You get 3 total plays of A and B combined for the whole match, so use them wisely
                and watch for patterns in your opponent&apos;s picks.
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
                        divisions: <strong>I</strong>, <strong>II</strong>, and <strong>III</strong>,
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

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Titles</h2>
          <p className={styles.titlesIntro}>
            Titles are earned automatically as you play, and are checked the moment a match finishes —
            so if you already qualify for one before it&apos;s awarded, you&apos;ll pick it up on your
            next completed game. Equip an earned title from your profile page to show it off next to
            your name in-game and on your profile.
          </p>

          <div className={styles.titleGroup}>
            <h3 className={styles.titleGroupHeading}>Games Played</h3>
            <dl className={styles.titlesList}>
              {GAMES_PLAYED_TITLES.map(({ title }) => (
                <div key={title.id} className={styles.titleRow} style={{ "--title-color": RARITY_COLOR[title.rarity] } as React.CSSProperties}>
                  <dt className={styles.titleRowName}>{title.name}</dt>
                  <dd className={styles.titleRowDesc}>{title.description}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className={styles.titleGroup}>
            <h3 className={styles.titleGroupHeading}>Win Streaks</h3>
            <dl className={styles.titlesList}>
              {WIN_STREAK_TITLES.map(({ title }) => (
                <div key={title.id} className={styles.titleRow} style={{ "--title-color": RARITY_COLOR[title.rarity] } as React.CSSProperties}>
                  <dt className={styles.titleRowName}>{title.name}</dt>
                  <dd className={styles.titleRowDesc}>{title.description}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className={styles.titleGroup}>
            <h3 className={styles.titleGroupHeading}>Rank</h3>
            <dl className={styles.titlesList}>
              <div className={styles.titleRow} style={{ "--title-color": RARITY_COLOR[INFINITY_RANK_TITLE.rarity] } as React.CSSProperties}>
                <dt className={styles.titleRowName}>{INFINITY_RANK_TITLE.name}</dt>
                <dd className={styles.titleRowDesc}>{INFINITY_RANK_TITLE.description}</dd>
              </div>
            </dl>
          </div>

          <div className={styles.titleGroup}>
            <h3 className={styles.titleGroupHeading}>Tournaments</h3>
            <dl className={styles.titlesList}>
              <div className={styles.titleRow} style={{ "--title-color": RARITY_COLOR[TOURNAMENT_CHAMPION_TITLE.rarity] } as React.CSSProperties}>
                <dt className={styles.titleRowName}>{TOURNAMENT_CHAMPION_TITLE.name}</dt>
                <dd className={styles.titleRowDesc}>{TOURNAMENT_CHAMPION_TITLE.description}</dd>
              </div>
            </dl>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}