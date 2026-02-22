import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import styles from "./page.module.css";
import formatRelativeTime from "@/lib/time";


async function getRecentMatches() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/fetchRecentGames`, {
    next: { revalidate: 30 } // refresh every 30 seconds
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((record: any) => ({
    ...record,
    timestamp: formatRelativeTime(record.timestamp)
  }));
}

export default async function Home() {
  const recentMatches = await getRecentMatches();

  return (
    <div className={styles.homePage}>
      <Header />

      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1>Master the Game of Rock Paper Scissors</h1>
          <p>Compete globally, climb the rankings, and become a champion!</p>
          <div className={styles.heroButtons}>
            <Link href="/rules" className={styles.secondaryButton}>Learn the Rules</Link>
            <Link href="/dashboard" className={styles.ctaButton}>Play Now</Link>
          </div>
        </div>
      </section>

      <section className={styles.features}>
        <h2>Why Play With Us?</h2>
        <div className={styles.featuresGrid}>
          {[
            { icon: '🏆', title: 'Competitive Leagues', desc: 'Join ranked matches and climb the global leaderboard' },
            { icon: '👥', title: 'Active Community', desc: 'Connect with players worldwide and join clubs' },
            { icon: '🤖', title: 'Practice Mode', desc: 'Sharpen your skills against our AI opponent' },
            { icon: '📊', title: 'Detailed Stats', desc: 'Track your progress with comprehensive analytics' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className={styles.featureCard}>
              <div className={styles.featureIcon}>{icon}</div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.liveMatches}>
        <h2>Recent Matches</h2>
        <div className={styles.matchesContainer}>
          {recentMatches.map((match: any, index: number) => (
            <div key={index} className={styles.matchCard}>
              <div className={styles.matchHeader}>
                <span className={styles.matchTime}>{match.timestamp}</span>
              </div>
              <div className={styles.matchContent}>
                <div className={styles.player}>{match.player1}</div>
                <div className={styles.vs}>
                  <span className={styles.score}>{match.score}</span>
                </div>
                <div className={styles.player}>{match.player2}</div>
              </div>
              <div className={styles.matchFooter}>
                <span className={styles.winner}>Winner: {match.winner}</span>
              </div>
            </div>
          ))}
        </div>

        <Link href="/leaderboard" className={styles.viewMoreButton}>
          View All Matches
        </Link>
      </section>

      <Footer />
    </div >
  );
}
