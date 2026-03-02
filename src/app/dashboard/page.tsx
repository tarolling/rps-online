"use client";

import { useEffect, useState } from "react";
import styles from "./DashboardPage.module.css";
import { useAuth } from "@/context/AuthContext";
import { getJSON, postJSON } from "@/lib/api";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/time";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PlayerMatch } from "@/types/common";
import config from "@/config/settings.json";
import RankBadge from "@/components/RankBadge";
import { ProfileData } from "@/types";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const { user } = useAuth();
  const [gameStats, setGameStats] = useState({
    rating: config.defaultRating,
    totalGames: 0,
    wins: 0,
    losses: 0,
    winRate: "N/A",
    currentStreak: 0,
    bestStreak: 0,
  });
  const [recentMatches, setRecentMatches] = useState<PlayerMatch[]>([]);
  const [playerData, setPlayerData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    const fetchStats = async () => {
      const data = await postJSON<{
        rating: number,
        totalGames: number,
        wins: number,
        losses: number,
        winRate: number,
        currentStreak: number,
        bestStreak: number
      }>("/api/fetchDashboardStats", {
        playerId: user?.uid,
      });

      if (!data) {
        setGameStats((prevState) => ({
          ...prevState,
          rating: config.defaultRating,
          totalGames: 0,
          wins: 0,
          losses: 0,
          winRate: "N/A",
          currentStreak: 0,
          bestStreak: 0,
        }));
      } else {
        setGameStats((prevState) => ({
          ...prevState,
          rating: data.rating,
          totalGames: data.totalGames,
          wins: data.wins,
          losses: data.losses,
          winRate: `${data.winRate.toFixed(1)}%`,
          currentStreak: data.currentStreak,
          bestStreak: data.bestStreak,
        }));
      }

      const recentGames = await getJSON<PlayerMatch[]>("/api/fetchRecentGames", {
        playerId: user?.uid,
      });

      setRecentMatches(recentGames);
    };

    fetchStats();
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchPlayer = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await postJSON<ProfileData>("/api/fetchPlayer", { uid: user.uid });
        setPlayerData(data);
      } catch (err: unknown) {
        console.error("Error fetching player:", err as Error);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayer();
  }, [user]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={() => window.location.reload()} />;

  return (
    <div className={styles.dashboard}>
      <Header />
      <div className={styles.dashboardContainer}>
        <section className={styles.welcomeSection}>
          <h1>Welcome back, {playerData?.username || "Player"}!</h1>
          <Link className={styles.playButton} href='/play'>
                        Quick Play
          </Link>
        </section>
        <div className={styles.dashboardGrid}>
          <section className={styles.statsCard}>
            <h2>Your Statistics</h2>
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <span className={styles.statValue}><RankBadge rating={gameStats.rating} /></span>
                <span className={styles.statLabel}>Rank</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{gameStats.rating}</span>
                <span className={styles.statLabel}>Skill Rating</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{gameStats.totalGames}</span>
                <span className={styles.statLabel}>Games Played</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{gameStats.winRate}</span>
                <span className={styles.statLabel}>Win Rate</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{gameStats.wins}</span>
                <span className={styles.statLabel}>Wins</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{gameStats.losses}</span>
                <span className={styles.statLabel}>Losses</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{gameStats.currentStreak}</span>
                <span className={styles.statLabel}>Current Streak</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{gameStats.bestStreak}</span>
                <span className={styles.statLabel}>Best Streak</span>
              </div>
            </div>
          </section>

          <section className={styles.recentMatchesCard}>
            <h2>Recent Matches</h2>
            <div className={styles.matchesList}>
              {recentMatches.map((match, index) => (
                <div key={index} className={`${styles.matchItem} ${styles[match.result.toLowerCase()]}`}
                  onClick={() => router.push(`/match/${match.id}`)}
                  style={{ cursor: "pointer" }}>
                  <Link href={`/profile/${match.opponentId}`} className={styles.matchOpponent}>
                    {match.opponentUsername}
                  </Link>
                  <span className={styles.matchResult}>{match.result}</span>
                  <div className={styles.matchDetails}>
                    <span>{match.playerScore} - {match.opponentScore}</span>
                    <span className={styles.matchDate}>{formatRelativeTime(match.date)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div >
      <Footer />
    </div >
  );
}

const LoadingState = () => (
  <div className={styles.dashboard}>
    <Header />
    <div className={styles.dashboardContainer}>
      <div className={styles.loadingSpinner}>Loading...</div>
    </div>
    <Footer />
  </div>
);

const ErrorState = ({ error, onRetry }: { error: string, onRetry: () => void }) => (
  <div className={styles.dashboard}>
    <Header />
    <div className={styles.dashboardContainer}>
      <div className={styles.errorCard}>
        <p>Error: {error}</p>
        <button onClick={onRetry}>Retry</button>
      </div>
    </div>
    <Footer />
  </div>
);
