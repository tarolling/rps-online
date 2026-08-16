"use client";

import { getDatabase, onValue, ref, remove } from "firebase/database";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import styles from "./AsyncGamesPage.module.css";
import { matchmakingQueueKey } from "@/lib/matchmaking";
import { formatCountdown } from "@/lib/time";
import config from "@/config/settings.json";
import { Game } from "@/types";
import { MatchStatus } from "@/types/neo4j";

type QueueEntry = { rating: number; timestamp: number };

function AsyncGamesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const db = getDatabase();

  const [games, setGames] = useState<Game[]>([]);
  const [queueEntry, setQueueEntry] = useState<QueueEntry | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const gamesRef = ref(db, "games");
    const unsubscribe = onValue(gamesRef, (snapshot) => {
      const all: Record<string, Game> = snapshot.val() || {};
      const mine = Object.values(all).filter((game) =>
        game.mode === "async" &&
                game.state === MatchStatus.InProgress &&
                (game.player1.id === user.uid || game.player2.id === user.uid),
      );
      setGames(mine);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, user?.uid]);

  useEffect(() => {
    if (!user) return;
    const queueRef = ref(db, `matchmaking_queue/${matchmakingQueueKey(user.uid, "async")}`);
    const unsubscribe = onValue(queueRef, (snapshot) => {
      setQueueEntry(snapshot.exists() ? snapshot.val() : null);
    });
    return () => unsubscribe();
  }, [db, user?.uid]);

  // Refresh "time remaining" text periodically
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const handleCancelQueue = async () => {
    if (!user) return;
    await remove(ref(db, `matchmaking_queue/${matchmakingQueueKey(user.uid, "async")}`));
  };

  return (
    <div className="app">
      <Header />
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Async Games</h1>
          <Link href="/play" className={styles.backLink}>← Back to Play</Link>
        </div>

        {queueEntry && (
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Searching</p>
            <div className={styles.queueCard}>
              <span>Queued for an async match…</span>
              <button className={styles.cancelBtn} onClick={handleCancelQueue}>Cancel</button>
            </div>
          </div>
        )}

        <div className={styles.section}>
          <p className={styles.sectionTitle}>Active Games ({games.length})</p>
          {loading ? (
            <p className={styles.empty}>Loading...</p>
          ) : games.length === 0 ? (
            <p className={styles.empty}>No active async games. Find an opponent to get started.</p>
          ) : (
            <div className={styles.gameList}>
              {games.map((game) => {
                const isPlayer1 = game.player1.id === user?.uid;
                const me = isPlayer1 ? game.player1 : game.player2;
                const opponent = isPlayer1 ? game.player2 : game.player1;
                const deadlineMs = (game.roundStartTimestamp ?? now) + (game.roundDurationSeconds ?? config.async.roundTimeoutSeconds) * 1000;
                const myTurn = !me.submitted;

                return (
                  <div key={game.id} className={styles.gameRow} onClick={() => router.push(`/game/async/${game.id}`)}>
                    <span className={styles.opponent}>vs {opponent.username}</span>
                    <span className={styles.score}>{me.score} - {opponent.score} · Round {game.currentRound}</span>
                    <span className={styles.deadline}>{myTurn ? formatCountdown(deadlineMs, now) : "waiting on opponent"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!queueEntry && (
          <button className={styles.findMoreBtn} onClick={() => router.push("/play")}>
            Find Another Match
          </button>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default AsyncGamesPage;
