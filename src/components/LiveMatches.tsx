"use client";

import { getDatabase, onValue, ref } from "firebase/database";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Game } from "@/types";
import { MatchStatus } from "@/types/neo4j";
import styles from "@/app/page.module.css";

type LiveGame = {
  id: string;
  player1: string;
  player2: string;
  score: string;
  round: number;
};

export default function LiveMatches() {
  const [liveGames, setLiveGames] = useState<LiveGame[]>([]);

  useEffect(() => {
    const db = getDatabase();
    const gamesRef = ref(db, "games");

    const unsub = onValue(gamesRef, (snapshot) => {
      const data = snapshot.val() ?? {};
      const live: LiveGame[] = Object.values(data as Record<string, Game>)
        .filter((g) => g.state === MatchStatus.InProgress)
        // filter bots out later when we have real players
        // .filter((g) => g.state === MatchStatus.InProgress && !g.player1.id.startsWith("bot_") && !g.player2.id.startsWith("bot_"))
        .map((g) => ({
          id: g.id,
          player1: g.player1.username,
          player2: g.player2.username,
          score: `${g.player1.score}-${g.player2.score}`,
          round: g.currentRound,
        }));
      setLiveGames(live);
    });

    return () => unsub();
  }, []);

  if (liveGames.length === 0) return null;

  return (
    <section className={styles.liveMatches}>
      <h2>🔴 Live Now</h2>
      <div className={styles.matchesContainer}>
        {liveGames.map((game) => (
          <Link key={game.id} href={`/spectate/${game.id}`} className={styles.matchCard}>
            <div className={styles.matchHeader}>
              <span className={styles.liveIndicator}>LIVE</span>
              <span className={styles.matchTime}>Round {game.round}</span>
            </div>
            <div className={styles.matchContent}>
              <span className={styles.player}>{game.player1}</span>
              <div className={styles.vs}>
                <span className={styles.score}>{game.score}</span>
              </div>
              <span className={styles.player}>{game.player2}</span>
            </div>
            <div className={styles.matchFooter}>
              <span className={styles.spectateHint}>👁️ Click to spectate</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}