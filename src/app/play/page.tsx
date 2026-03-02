"use client";

import { get, getDatabase, onValue, ref, remove } from "firebase/database";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { findMatch } from "@/lib/matchmaking";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import styles from "./MatchmakingPage.module.css";
import { postJSON } from "@/lib/api";
import { ProfileData } from "@/types";

type MatchStatus = "idle" | "searching" | "matched" | "error";

function MatchmakingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const db = getDatabase();

  const [matchStatus, setMatchStatus] = useState<MatchStatus>("idle");
  const [onlineCount, setOnlineCount] = useState(0);

  // Track online player count and redirect if already in a game
  useEffect(() => {
    if (!user) return;

    const queueRef = ref(db, "matchmaking_queue");
    const gamesRef = ref(db, "games");

    const unsubscribe = onValue(queueRef, (queueSnap) => {
      onValue(gamesRef, (gamesSnap) => {
        const queueCount = Object.keys(queueSnap.val() || {}).length;
        const gameCount = Object.keys(gamesSnap.val() || {}).length;
        setOnlineCount(queueCount + gameCount * 2);
      });
    });

    const redirectIfInGame = async () => {
      const snapshot = await get(gamesRef);
      const games = snapshot.val() || {};
      for (const [gameId, game] of Object.entries(games) as [string, any][]) {
        if (
          game.state === "in_progress" &&
                    (game.player1.id === user.uid || game.player2.id === user.uid)
        ) {
          router.push(`/game/${gameId}`);
          return;
        }
      }
    };

    redirectIfInGame();

    return () => {
      unsubscribe();
      if (matchStatus === "searching") {
        remove(ref(db, `matchmaking_queue/${user.uid}`));
      }
    };
  }, [db, user?.uid, matchStatus]);

  const handleFindMatch = async () => {
    if (!user) return;
    setMatchStatus("searching");
    try {
      const playerInfo = await postJSON<ProfileData>("/api/fetchPlayer", { uid: user?.uid });
      const result = await findMatch(user?.uid, playerInfo.username, playerInfo.rating);

      if ("gameID" in result) {
        setMatchStatus("matched");
        router.push(`/game/${result.gameID}`);
      } else if (result.error === "Match timeout") {
        setMatchStatus("idle");
      }
    } catch (err) {
      await remove(ref(db, `matchmaking_queue/${user?.uid}`));
      console.error("Matchmaking error:", err);
      setMatchStatus("error");
    }
  };

  const handleCancel = async () => {
    await remove(ref(db, `matchmaking_queue/${user?.uid}`));
    setMatchStatus("idle");
  };

  return (
    <div className="app">
      <Header />
      <main className={styles.main}>
        <div className={styles.grid}>

          {/* Ranked matchmaking */}
          {user && (<div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Ranked Match</h2>
              <p className={styles.subtitle}>Compete to climb the leaderboard.</p>
            </div>

            <div className={styles.onlineCount}>
              <span className={styles.onlineDot} />
              <span>{onlineCount} players online</span>
            </div>

            {matchStatus === "idle" && (
              <button className={styles.primaryButton} onClick={handleFindMatch}>
                                Find Match
              </button>
            )}

            {matchStatus === "searching" && (
              <div className={styles.statusBlock}>
                <div className={styles.spinner} />
                <p className={styles.statusText}>Searching for an opponent…</p>
                <button className={styles.cancelButton} onClick={handleCancel}>
                                    Cancel
                </button>
              </div>
            )}

            {matchStatus === "matched" && (
              <div className={styles.statusBlock}>
                <div className={styles.successIcon}>✓</div>
                <p className={styles.successText}>Match Found!</p>
                <p className={styles.statusText}>Joining game…</p>
              </div>
            )}

            {matchStatus === "error" && (
              <div className={styles.statusBlock}>
                <p className={styles.errorText}>Something went wrong. Please try again.</p>
                <button className={styles.primaryButton} onClick={handleFindMatch}>
                                    Retry
                </button>
              </div>
            )}
          </div>)}

          {/* vs AI */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Play vs AI</h2>
              <p className={styles.subtitle}>Practice without affecting your rating.</p>
            </div>
            <button className={styles.secondaryButton} onClick={() => router.push("/playAI")}>
                            Play
            </button>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}

export default MatchmakingPage;