"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import styles from "./LeaderboardPage.module.css";
import RankBadge from "@/components/RankBadge";
import { getJSON } from "@/lib/api";
import { Rank, RANK_TIERS } from "@/lib/ranks";

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

// Unique rank names in order
const RANKS: Rank[] = [...new Map(RANK_TIERS.map((t) => [t.rank, t])).keys()];

const RANK_ICON = ["👑", "🥈", "🥉"];

function LeaderboardPage() {
  const [activeType, setActiveType] = useState<LeaderboardType>("rating");
  const [activeRank, setActiveRank] = useState<Rank | null>(null);
  const [playerData, setPlayerData] = useState<Player[] | null>(null);
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams({ type: activeType });
    if (activeRank) params.set("rank", activeRank);
    getJSON<Player[]>(`/api/fetchLeaderboard?${params}`)
      .then(setPlayerData)
      .catch((err) => { console.error(err); setPlayerData([]); });
  }, [activeType, activeRank]);

  const colHeader = LEADERBOARD_TABS.find((t) => t.type === activeType)!.colHeader;

  return (
    <div className="app">
      <Header />
      <main className={styles.main}>
        <h1>Top 100 Players</h1>

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
          {RANKS.map((rank) => (
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