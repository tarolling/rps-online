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
import { PlayMode, ProfileData } from "@/types";
import { GAME_MODES, PLAY_MODES } from "@/lib/gameModes";
import { useRouter } from "next/navigation";
import { subscribeMyTurnAsyncGames } from "@/lib/matchmaking";

type StatsFilter = PlayMode | "all";

const STATS_FILTERS: StatsFilter[] = ["all", ...PLAY_MODES];

interface DashboardStats {
  rating: number | null;
  totalGames: number;
  wins: number;
  losses: number;
  winRate: string;
  currentStreak: number;
  bestStreak: number;
}

const EMPTY_STATS: DashboardStats = {
  rating: null,
  totalGames: 0,
  wins: 0,
  losses: 0,
  winRate: "N/A",
  currentStreak: 0,
  bestStreak: 0,
};

const EMPTY_STATS_BY_FILTER = Object.fromEntries(
  STATS_FILTERS.map((filter) => [filter, EMPTY_STATS]),
) as Record<StatsFilter, DashboardStats>;

const EMPTY_MATCHES_BY_FILTER = Object.fromEntries(
  STATS_FILTERS.map((filter): [StatsFilter, PlayerMatch[]] => [filter, []]),
) as Record<StatsFilter, PlayerMatch[]>;

export default function DashboardPage() {
  const { user } = useAuth();
  const [myTurnGameCount, setMyTurnGameCount] = useState(0);
  const [statsFilter, setStatsFilter] = useState<StatsFilter>("all");
  const [statsByFilter, setStatsByFilter] = useState(EMPTY_STATS_BY_FILTER);
  const [matchesByFilter, setMatchesByFilter] = useState(EMPTY_MATCHES_BY_FILTER);
  const [playerData, setPlayerData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  const gameStats = statsByFilter[statsFilter];
  const recentMatches = matchesByFilter[statsFilter];

  useEffect(() => {
    if (!user) return;

    const fetchStatsForFilter = async (filter: StatsFilter) => {
      const data = await postJSON<{
        rating: number | null,
        totalGames: number,
        wins: number,
        losses: number,
        winRate: number,
        currentStreak: number,
        bestStreak: number
      }>("/api/fetchDashboardStats", {
        playerId: user.uid,
        mode: filter,
      });

      const recentGames = await getJSON<PlayerMatch[]>("/api/fetchRecentGames", {
        playerId: user.uid,
        mode: filter === "all" ? null : filter,
      });

      return {
        filter,
        stats: data
          ? {
            rating: data.rating,
            totalGames: data.totalGames,
            wins: data.wins,
            losses: data.losses,
            winRate: `${data.winRate.toFixed(1)}%`,
            currentStreak: data.currentStreak,
            bestStreak: data.bestStreak,
          }
          : EMPTY_STATS,
        recentGames,
      };
    };

    const fetchAllStats = async () => {
      const results = await Promise.all(STATS_FILTERS.map(fetchStatsForFilter));

      setStatsByFilter(Object.fromEntries(
        results.map(({ filter, stats }) => [filter, stats]),
      ) as Record<StatsFilter, DashboardStats>);

      setMatchesByFilter(Object.fromEntries(
        results.map(({ filter, recentGames }) => [filter, recentGames]),
      ) as Record<StatsFilter, PlayerMatch[]>);
    };

    fetchAllStats();
  }, [user]);

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

  useEffect(() => {
    if (!user) {
      setMyTurnGameCount(0);
      return;
    }
    return subscribeMyTurnAsyncGames(user.uid, setMyTurnGameCount);
  }, [user]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={() => window.location.reload()} />;

  return (
    <div className={styles.dashboard}>
      <Header />
      <div className={styles.dashboardContainer}>
        <section className={styles.welcomeSection}>
          <h1>Welcome back, {playerData?.username || "Player"}!</h1>
          <div className={styles.playButtons}>
            <Link className={styles.playButton} href='/play'>
                        Quick Play
            </Link>
            <Link className={styles.playButton} href='/asyncGames'>
                        Async Games
              {myTurnGameCount > 0 && <span className={styles.playButtonBadge}>{myTurnGameCount}</span>}
            </Link>
          </div>
        </section>
        <div className={styles.dashboardGrid}>
          <section className={styles.statsCard}>
            <h2>Your Statistics</h2>
            <div className={styles.filterTabs} role="tablist" aria-label="Filter stats by game mode">
              {STATS_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type='button'
                  role="tab"
                  aria-selected={statsFilter === filter}
                  className={`${styles.filterTab} ${statsFilter === filter ? styles.filterTabActive : ""}`}
                  onClick={() => setStatsFilter(filter)}
                >
                  {filter === "all" ? "All" : GAME_MODES[filter].label}
                </button>
              ))}
            </div>
            <div className={styles.statsGrid}>
              {statsFilter === "all" ? (
                PLAY_MODES.map((mode) => (
                  <div className={styles.statItem} key={mode}>
                    <span className={styles.statValue}>
                      <RankBadge rating={playerData?.ratings[mode] ?? config.defaultRating} variant='compact' />
                      {playerData?.ratings[mode] ?? config.defaultRating}
                    </span>
                    <span className={styles.statLabel}>{GAME_MODES[mode].label} Rating</span>
                  </div>
                ))
              ) : (
                <>
                  <div className={styles.statItem}>
                    <span className={styles.statValue}><RankBadge rating={gameStats.rating ?? config.defaultRating} /></span>
                    <span className={styles.statLabel}>Rank</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statValue}>{gameStats.rating ?? config.defaultRating}</span>
                    <span className={styles.statLabel}>{GAME_MODES[statsFilter].label} Rating</span>
                  </div>
                </>
              )}
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
