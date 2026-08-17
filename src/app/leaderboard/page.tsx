"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import styles from "./LeaderboardPage.module.css";
import RankBadge from "@/components/RankBadge";
import { getJSON } from "@/lib/api";
import { getRankNames } from "@/lib/ranks";
import type { PlayMode, RankName } from "@/types";
import { GAME_MODES, PLAY_MODES } from "@/lib/gameModes";

type Player = {
  uid: string;
  username: string;
  rating: number;
  statValue: number;
};

type LeaderboardType = "rating" | "winStreak" | "gamesPlayed";

const LEADERBOARD_TABS: { type: LeaderboardType; label: string; colHeader: string }[] = [
  { type: "rating",      label: "Skill Rating",  colHeader: "Rating"    },
  { type: "winStreak",   label: "Win Streak",    colHeader: "Streak"    },
  { type: "gamesPlayed", label: "Games Played",  colHeader: "Games"     },
];

const MODE_TABS: { mode: PlayMode; label: string }[] = PLAY_MODES.map((mode) => ({ mode, label: GAME_MODES[mode].label }));

const RANK_ICON = ["👑", "🥈", "🥉"];

function LeaderboardPage() {
  const [activeMode, setActiveMode] = useState<PlayMode>("blitz");
  const [activeType, setActiveType] = useState<LeaderboardType>("rating");
  const [activeRank, setActiveRank] = useState<RankName | null>(null);
  const [playerData, setPlayerData] = useState<Player[] | null>(null);
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams({ type: activeType, mode: activeMode });
    if (activeRank) params.set("rank", activeRank);
    getJSON<Player[]>(`/api/fetchLeaderboard?${params}`)
      .then(setPlayerData)
      .catch((err) => { console.error(err); setPlayerData([]); });
  }, [activeType, activeRank, activeMode]);

  const colHeader = LEADERBOARD_TABS.find((t) => t.type === activeType)!.colHeader;

  return (
    <div className="app">
      <Header />
      <main className={styles.main}>
        <h1>Top 100 Players</h1>

        {/* Mode tabs */}
        <div className={styles.tabs}>
          {MODE_TABS.map(({ mode, label }) => (
            <button
              key={mode}
              className={`${styles.tab} ${activeMode === mode ? styles.tabActive : ""}`}
              onClick={() => setActiveMode(mode)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Type tabs */}
        <div className={styles.tabs}>
          {LEADERBOARD_TABS.map(({ type, label }) => (
            <button
              key={type}
              className={`${styles.tab} ${activeType === type ? styles.tabActive : ""}`}
              onClick={() => setActiveType(type)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Rank filter */}
        <div className={styles.rankFilter}>
          <button
            className={`${styles.rankChip} ${activeRank === null ? styles.rankChipActive : ""}`}
            onClick={() => setActiveRank(null)}
          >
            Global
          </button>
          {getRankNames().map((rank) => (
            <button
              key={rank}
              className={`${styles.rankChip} ${activeRank === rank ? styles.rankChipActive : ""}`}
              onClick={() => setActiveRank(rank)}
            >
              {rank}
            </button>
          ))}
        </div>

        {playerData === null ? (
          <p className={styles.status}>Loading leaderboard...</p>
        ) : playerData.length === 0 ? (
          <p className={styles.status}>No data available.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.rankCol}>#</th>
                  <th>Username</th>
                  <th className={styles.ratingCol}>{colHeader}</th>
                </tr>
              </thead>
              <tbody>
                {playerData.map((player, index) => (
                  <tr
                    key={player.uid}
                    className={styles.row}
                    onClick={() => router.push(`/profile/${player.uid}`)}
                  >
                    <td className={styles.rank}>
                      {index < 3 ? RANK_ICON[index] : index + 1}
                    </td>
                    <td className={styles.username}>
                      <Link href={`/profile/${player.uid}`} onClick={(e) => e.stopPropagation()}>
                        {player.username}
                      </Link>
                      <RankBadge rating={player.rating} variant="compact" />
                    </td>
                    <td className={styles.rating}>{player.statValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default LeaderboardPage;