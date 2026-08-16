import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import styles from "./page.module.css";
import { formatRelativeTime } from "@/lib/time";
import MatchCard from "@/components/MatchCard";
import HeroButtons from "@/components/HeroButtons";
import LiveMatches from "@/components/LiveMatches";
import { getRecentGames } from "@/lib/recentGames";

export const revalidate = 0;

async function getRecentMatches() {
  const data = await getRecentGames(null, null);
  return data.map((record: any) => ({
    ...record,
    timestamp: formatRelativeTime(record.timestamp),
  }));
}

const FEATURES = [
  {
    icon: "⚔️",
    label: "01",
    title: "Ranked Matches",
    desc: "Every game counts. Climb divisions, earn your rank, prove you belong at the top.",
  },
  {
    icon: "🛡️",
    label: "02",
    title: "Clubs & Community",
    desc: "Form squads, challenge rivals, and build a reputation on the global stage.",
  },
  {
    icon: "🤖",
    label: "03",
    title: "AI Practice",
    desc: "Train without pressure. Refine your reads and sharpen your instincts.",
  },
  {
    icon: "📈",
    label: "04",
    title: "Deep Analytics",
    desc: "Track win rates, streaks, and match history. Know your game inside out.",
  },
];

export default async function Home() {
  const recentMatches = await getRecentMatches();

  return (
    <div className={styles.homePage}>
      <Header />

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} aria-hidden>
          <span className={styles.floatGlyph} data-glyph="✊" />
          <span className={styles.floatGlyph} data-glyph="✋" />
          <span className={styles.floatGlyph} data-glyph="✌️" />
        </div>

        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow}>Competitive Rock Paper Scissors</p>
          <h1 className={styles.heroHeadline}>
            Rise.<br />
            Outplay.<br />
            <span className={styles.heroAccent}>Dominate.</span>
          </h1>
          <p className={styles.heroSub}>
            Real rankings. Real stakes. The world&#39;s most underestimated game, taken seriously.
          </p>
          <HeroButtons />
        </div>

        <div className={styles.heroDivider} aria-hidden />
      </section>

      {/* ── Ticker ── */}
      <div className={styles.ticker} aria-hidden>
        <div className={styles.tickerTrack}>
          {Array.from({ length: 3 }).map((_, i) => (
            <span key={i} className={styles.tickerItems}>
              <span>✊ Ranked Matchmaking</span>
              <span className={styles.tickerDot}>✦</span>
              <span>✋ Global Leaderboard</span>
              <span className={styles.tickerDot}>✦</span>
              <span>✌️ Live Spectating</span>
              <span className={styles.tickerDot}>✦</span>
              <span>🏆 Competitive Clubs</span>
              <span className={styles.tickerDot}>✦</span>
              <span>🤖 AI Training</span>
              <span className={styles.tickerDot}>✦</span>
              <span>🏆 Exciting Tournaments</span>
              <span className={styles.tickerDot}>✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Features ── */}
      <section className={styles.features}>
        <div className={styles.featuresInner}>
          <div className={styles.featuresHeader}>
            <p className={styles.sectionEyebrow}>Why play here</p>
            <h2 className={styles.sectionTitle}>Built for competitors.</h2>
          </div>
          <div className={styles.featuresGrid}>
            {FEATURES.map(({ icon, label, title, desc }) => (
              <div key={title} className={styles.featureCard}>
                <span className={styles.featureLabel}>{label}</span>
                <span className={styles.featureIcon}>{icon}</span>
                <h3 className={styles.featureTitle}>{title}</h3>
                <p className={styles.featureDesc}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live matches ── */}
      <LiveMatches />

      {/* ── Recent matches ── */}
      <section className={styles.recentSection}>
        <div className={styles.recentInner}>
          <div className={styles.recentHeader}>
            <p className={styles.sectionEyebrow}>Match feed</p>
            <h2 className={styles.sectionTitle}>Recent battles.</h2>
          </div>
          <div className={styles.matchesGrid}>
            {recentMatches.map((match: any, index: number) => (
              <MatchCard key={index} match={match} index={index} />
            ))}
          </div>
          <div className={styles.leaderboardCta}>
            <Link href="/leaderboard" className={styles.leaderboardLink}>
              View Full Leaderboard →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className={styles.bottomCta}>
        <div className={styles.bottomCtaInner}>
          <h2 className={styles.bottomCtaTitle}>Your rank awaits.</h2>
          <p className={styles.bottomCtaSub}>Every champion started at zero. What&apos;s your excuse?</p>
          <Link href="/dashboard" className={styles.bottomCtaBtn}>Start Climbing</Link>
        </div>
      </section>

      <Footer />
    </div >
  );
}
