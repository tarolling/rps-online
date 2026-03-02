"use client";

import { get, getDatabase, onValue, ref, remove } from "firebase/database";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { findMatch } from "@/lib/matchmaking";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import RankBadge from "@/components/RankBadge";
import styles from "./MatchmakingPage.module.css";
import { postJSON } from "@/lib/api";
import { ProfileData } from "@/types";
import { getRankTier } from "@/lib/ranks";
import { MatchStatus } from "@/types/neo4j";

type MatchStatus = "idle" | "searching" | "matched" | "error";

function MatchmakingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const db = getDatabase();

  const [matchStatus, setMatchStatus] = useState<MatchStatus>("idle");
  const [onlineCount, setOnlineCount] = useState(0);
  const [playerInfo, setPlayerInfo] = useState<ProfileData | null>(null);

  useEffect(() => {
    if (!user) return;
    postJSON<ProfileData>("/api/fetchPlayer", { uid: user.uid })
      .then(setPlayerInfo)
      .catch(console.error);
  }, [user?.uid]);

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
        if (game.state === MatchStatus.InProgress && (game.player1.id === user.uid || game.player2.id === user.uid)) {
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
      const info = await postJSON<ProfileData>("/api/fetchPlayer", { uid: user?.uid });
      if (!playerInfo) setPlayerInfo(info);
      const result = await findMatch(user?.uid, info.username, info.rating);

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

  const rankTier = playerInfo ? getRankTier(playerInfo.rating) : null;
  const rankColor = rankTier?.rank === "Infinity" ? "#ffffff" : rankTier?.color;

  return (
    <div className="app">
      <Header />
      <main className={styles.main}>

        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Select Mode</h1>
          <div className={styles.onlineCount}>
            <span className={styles.onlineDot} />
            <span>{onlineCount} online</span>
          </div>
        </div>

        <div className={styles.grid}>

          {/* ── Ranked ── */}
          {user && (
            <div
              className={`${styles.card} ${styles.cardRanked}`}
              style={{ "--rank-color": rankColor ?? "var(--color-primary)", "--rank-glow": rankTier?.glow ?? "transparent" } as React.CSSProperties}
            >
              <div className={styles.cardBg} aria-hidden />

              <div className={styles.modeTag}>Competitive</div>
              <h2 className={styles.cardTitle}>Ranked</h2>
              <p className={styles.cardDesc}>Climb the leaderboard. Your rating is on the line.</p>

              {playerInfo && (
                <div className={styles.playerSnapshot}>
                  <RankBadge rating={playerInfo.rating} variant="full" />
                </div>
              )}

              <div className={styles.cardFooter}>
                {matchStatus === "idle" && (
                  <button className={styles.primaryBtn} onClick={handleFindMatch}>
                    Find Match
                  </button>
                )}

                {matchStatus === "searching" && (
                  <div className={styles.statusBlock}>
                    <div className={styles.searchingRow}>
                      <div className={styles.spinner} />
                      <span className={styles.statusText}>Searching for opponent…</span>
                    </div>
                    <button className={styles.cancelBtn} onClick={handleCancel}>Cancel</button>
                  </div>
                )}

                {matchStatus === "matched" && (
                  <div className={styles.statusBlock}>
                    <div className={styles.matchedRow}>
                      <span className={styles.successIcon}>✓</span>
                      <span className={styles.successText}>Match Found — Joining…</span>
                    </div>
                  </div>
                )}

                {matchStatus === "error" && (
                  <div className={styles.statusBlock}>
                    <p className={styles.errorText}>Something went wrong.</p>
                    <button className={styles.primaryBtn} onClick={handleFindMatch}>Retry</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── vs AI ── */}
          <div className={`${styles.card} ${styles.cardAI}`}>
            <div className={styles.cardBg} aria-hidden />
            <div className={styles.modeTag}>Practice</div>
            <h2 className={styles.cardTitle}>vs AI</h2>
            <p className={styles.cardDesc}>Sharpen your skills. No rating at stake.</p>
            <div className={styles.cardFooter}>
              <button className={styles.secondaryBtn} onClick={() => router.push("/playAI")}>
                Play
              </button>
            </div>
          </div>

          {/* ── TBD Mode ── */}
          <div className={`${styles.card} ${styles.cardTBD} ${styles.comingSoon}`}>
            <div className={styles.cardBg} aria-hidden />
            <div className={styles.modeTag}>Coming Soon</div>
            <h2 className={styles.cardTitle}>Casual</h2>
            <p className={styles.cardDesc}>Play for fun without affecting your rank.</p>
            <div className={styles.cardFooter}>
              <button className={styles.secondaryBtn} disabled>
                Unavailable
              </button>
            </div>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}

export default MatchmakingPage;