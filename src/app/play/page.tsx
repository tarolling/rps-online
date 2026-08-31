"use client";

import { get, getDatabase, onValue, ref, remove } from "firebase/database";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { findMatch, matchmakingQueueKey } from "@/lib/matchmaking";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import RankBadge from "@/components/RankBadge";
import styles from "./MatchmakingPage.module.css";
import { postJSON } from "@/lib/api";
import { Game, PlayMode, ProfileData } from "@/types";
import { getRankTier } from "@/lib/ranks";
import { MatchStatus } from "@/types/neo4j";
import config from "@/config/settings.json";
import { PLAY_MODES } from "@/lib/gameModes";

type MatchmakingStatus = "idle" | "searching" | "matched" | "error";
type AsyncQueueStatus = "idle" | "queueing" | "queued" | "matched" | "error";

function MatchmakingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const db = getDatabase();

  const [matchStatus, setMatchStatus] = useState<MatchmakingStatus>("idle");
  const [asyncStatus, setAsyncStatus] = useState<AsyncQueueStatus>("idle");
  const [wildcardStatus, setWildcardStatus] = useState<MatchmakingStatus>("idle");
  const [onlineCounts, setOnlineCounts] = useState<Record<PlayMode, number>>(
    () => Object.fromEntries(PLAY_MODES.map((m) => [m, 0])) as Record<PlayMode, number>,
  );
  const [playerInfo, setPlayerInfo] = useState<ProfileData | null>(null);
  const [asyncErrorMessage, setAsyncErrorMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    postJSON<ProfileData>("/api/fetchPlayer", { uid: user.uid })
      .then(setPlayerInfo)
      .catch(console.error);
  }, [user?.uid]);

  // Track online player count and redirect if already in a blitz game.
  // Async games never force a redirect here — players can have several going
  // at once and check them from /asyncGames whenever they like.
  useEffect(() => {
    if (!user) return;

    const queueRef = ref(db, "matchmaking_queue");
    const gamesRef = ref(db, "games");

    const unsubscribe = onValue(queueRef, (queueSnap) => {
      onValue(gamesRef, (gamesSnap) => {
        const queue = Object.values(queueSnap.val() || {}) as { mode?: PlayMode }[];
        const games = Object.values(gamesSnap.val() || {}) as Game[];

        const counts = Object.fromEntries(PLAY_MODES.map((mode) => {
          const queueCount = queue.filter((entry) => (entry.mode ?? "blitz") === mode).length;
          const gameCount = games.filter((game) => (game.mode ?? "blitz") === mode).length;
          return [mode, queueCount + gameCount * 2];
        })) as Record<PlayMode, number>;

        setOnlineCounts(counts);
      });
    });

    const redirectIfInGame = async () => {
      const snapshot = await get(gamesRef);
      const games = snapshot.val() || {};
      for (const [gameId, game] of Object.entries(games) as [string, Game][]) {
        const mode = game.mode ?? "blitz";
        if (mode === "blitz" && game.state === MatchStatus.InProgress && (game.player1.id === user.uid || game.player2.id === user.uid)) {
          router.push(`/game/${gameId}`);
          return;
        }
        if (mode === "wildcard" && game.state === MatchStatus.InProgress && (game.player1.id === user.uid || game.player2.id === user.uid)) {
          router.push(`/game/wildcard/${gameId}`);
          return;
        }
      }
    };

    redirectIfInGame();

    return () => {
      unsubscribe();
      if (matchStatus === "searching") {
        remove(ref(db, `matchmaking_queue/${matchmakingQueueKey(user.uid, "blitz")}`));
      }
      if (wildcardStatus === "searching") {
        remove(ref(db, `matchmaking_queue/${matchmakingQueueKey(user.uid, "wildcard")}`));
      }
    };
  }, [db, user?.uid, matchStatus, wildcardStatus]);

  const handleFindMatch = async () => {
    if (!user) return;
    setMatchStatus("searching");
    try {
      const info = await postJSON<ProfileData>("/api/fetchPlayer", { uid: user?.uid });
      if (!playerInfo) setPlayerInfo(info);
      const result = await findMatch(user?.uid, info.username, info.ratings.blitz ?? config.defaultRating, "blitz");

      if ("gameID" in result) {
        setMatchStatus("matched");
        router.push(`/game/${result.gameID}`);
      } else if ("error" in result && result.error === "Match timeout") {
        setMatchStatus("idle");
      }
    } catch (err) {
      await remove(ref(db, `matchmaking_queue/${matchmakingQueueKey(user?.uid ?? "", "blitz")}`));
      console.error("Matchmaking error:", err);
      setMatchStatus("error");
    }
  };

  const handleCancel = async () => {
    await remove(ref(db, `matchmaking_queue/${matchmakingQueueKey(user?.uid ?? "", "blitz")}`));
    setMatchStatus("idle");
  };

  const handleFindAsyncMatch = async () => {
    if (!user) return;
    setAsyncStatus("queueing");
    setAsyncErrorMessage("");
    try {
      const info = await postJSON<ProfileData>("/api/fetchPlayer", { uid: user?.uid });
      if (!playerInfo) setPlayerInfo(info);
      const result = await findMatch(user?.uid, info.username, info.ratings.async ?? config.defaultRating, "async", info.isPremium);

      if ("gameID" in result) {
        setAsyncStatus("matched");
        router.push(`/game/async/${result.gameID}`);
      } else if ("queued" in result) {
        setAsyncStatus("queued");
      } else if ("error" in result) {
        setAsyncErrorMessage(result.error);
        setAsyncStatus("error");
      }
    } catch (err) {
      await remove(ref(db, `matchmaking_queue/${matchmakingQueueKey(user?.uid ?? "", "async")}`));
      console.error("Async matchmaking error:", err);
      setAsyncStatus("error");
    }
  };

  const handleCancelAsync = async () => {
    await remove(ref(db, `matchmaking_queue/${matchmakingQueueKey(user?.uid ?? "", "async")}`));
    setAsyncStatus("idle");
  };

  const handleFindWildcardMatch = async () => {
    if (!user) return;
    setWildcardStatus("searching");
    try {
      const info = await postJSON<ProfileData>("/api/fetchPlayer", { uid: user?.uid });
      if (!playerInfo) setPlayerInfo(info);
      const result = await findMatch(user?.uid, info.username, info.ratings.wildcard ?? config.defaultRating, "wildcard");

      if ("gameID" in result) {
        setWildcardStatus("matched");
        router.push(`/game/wildcard/${result.gameID}`);
      } else if ("error" in result && result.error === "Match timeout") {
        setWildcardStatus("idle");
      }
    } catch (err) {
      await remove(ref(db, `matchmaking_queue/${matchmakingQueueKey(user?.uid ?? "", "wildcard")}`));
      console.error("Wildcard matchmaking error:", err);
      setWildcardStatus("error");
    }
  };

  const handleCancelWildcard = async () => {
    await remove(ref(db, `matchmaking_queue/${matchmakingQueueKey(user?.uid ?? "", "wildcard")}`));
    setWildcardStatus("idle");
  };

  const rankTier = playerInfo ? getRankTier(playerInfo.ratings.blitz ?? config.defaultRating) : null;
  const rankColor = rankTier?.rank === "Infinity" ? "#ffffff" : rankTier?.color;
  const asyncRankTier = playerInfo ? getRankTier(playerInfo.ratings.async ?? config.defaultRating) : null;
  const asyncRankColor = asyncRankTier?.rank === "Infinity" ? "#ffffff" : asyncRankTier?.color;
  const wildcardRankTier = playerInfo ? getRankTier(playerInfo.ratings.wildcard ?? config.defaultRating) : null;
  const wildcardRankColor = wildcardRankTier?.rank === "Infinity" ? "#ffffff" : wildcardRankTier?.color;

  return (
    <div className="app">
      <Header />
      <main className={styles.main}>

        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Select Mode</h1>
        </div>

        <div className={styles.grid}>

          {/* ── Blitz ── */}
          <div
            className={`${styles.card} ${styles.cardAccent} ${!user ? styles.signedOut : ""}`}
            style={{ "--rank-color": rankColor ?? "var(--color-primary)", "--rank-glow": rankTier?.glow ?? "transparent" } as React.CSSProperties}
          >
            <div className={styles.cardBg} aria-hidden />

            <div className={styles.cardTopRow}>
              <div className={styles.modeTag}>Competitive</div>
              {user && (
                <div className={styles.onlineCount}>
                  <span className={styles.onlineDot} />
                  <span>{onlineCounts.blitz} online</span>
                </div>
              )}
            </div>
            <h2 className={styles.cardTitle}>Blitz</h2>
            <p className={styles.cardDesc}>Climb the leaderboard. Your rating is on the line.</p>

            {playerInfo && (
              <div className={styles.playerSnapshot}>
                <RankBadge rating={playerInfo.ratings.blitz ?? config.defaultRating} variant="full" premium={playerInfo.isPremium} />
              </div>
            )}

            <div className={styles.cardFooter}>
              {!user && (
                <div className={styles.statusBlock}>
                  <p className={styles.signInText}>Sign in to play.</p>
                  <button className={styles.primaryBtn} onClick={() => router.push("/login")}>
                    Sign In
                  </button>
                </div>
              )}

              {user && matchStatus === "idle" && (
                <button className={styles.primaryBtn} onClick={handleFindMatch}>
                  Find Match
                </button>
              )}

              {user && matchStatus === "searching" && (
                <div className={styles.statusBlock}>
                  <div className={styles.searchingRow}>
                    <div className={styles.spinner} />
                    <span className={styles.statusText}>Searching for opponent...</span>
                  </div>
                  <button className={styles.cancelBtn} onClick={handleCancel}>Cancel</button>
                </div>
              )}

              {user && matchStatus === "matched" && (
                <div className={styles.statusBlock}>
                  <div className={styles.matchedRow}>
                    <span className={styles.successIcon}>✓</span>
                    <span className={styles.successText}>Match Found! Joining...</span>
                  </div>
                </div>
              )}

              {user && matchStatus === "error" && (
                <div className={styles.statusBlock}>
                  <p className={styles.errorText}>Something went wrong.</p>
                  <button className={styles.primaryBtn} onClick={handleFindMatch}>Retry</button>
                </div>
              )}
            </div>
          </div>

          {/* ── Async ── */}
          <div
            className={`${styles.card} ${styles.cardAccent} ${!user ? styles.signedOut : ""}`}
            style={{ "--rank-color": asyncRankColor ?? "var(--color-primary)", "--rank-glow": asyncRankTier?.glow ?? "transparent" } as React.CSSProperties}
          >
            <div className={styles.cardBg} aria-hidden />

            <div className={styles.cardTopRow}>
              <div className={styles.modeTag}>Correspondence</div>
              {user && (
                <div className={styles.onlineCount}>
                  <span className={styles.onlineDot} />
                  <span>{onlineCounts.async} online</span>
                </div>
              )}
            </div>
            <h2 className={styles.cardTitle}>Async</h2>
            <p className={styles.cardDesc}>24 hours per round. Play several games at once, check in whenever.</p>

            {playerInfo && (
              <div className={styles.playerSnapshot}>
                <RankBadge rating={playerInfo.ratings.async ?? config.defaultRating} variant="full" premium={playerInfo.isPremium} />
              </div>
            )}

            <div className={styles.cardFooter}>
              {!user && (
                <div className={styles.statusBlock}>
                  <p className={styles.signInText}>Sign in to play.</p>
                  <button className={styles.primaryBtn} onClick={() => router.push("/login")}>
                    Sign In
                  </button>
                </div>
              )}

              {user && asyncStatus === "idle" && (
                <div className={styles.buttonRow}>
                  <button className={styles.primaryBtn} onClick={handleFindAsyncMatch}>
                    Find Match
                  </button>
                  <button className={styles.secondaryBtn} onClick={() => router.push("/asyncGames")}>
                    View Async Games
                  </button>
                </div>
              )}

              {user && asyncStatus === "queueing" && (
                <div className={styles.statusBlock}>
                  <div className={styles.searchingRow}>
                    <div className={styles.spinner} />
                    <span className={styles.statusText}>Looking for an opponent…</span>
                  </div>
                </div>
              )}

              {user && asyncStatus === "queued" && (
                <div className={styles.statusBlock}>
                  <div className={styles.searchingRow}>
                    <span className={styles.statusText}>Queued. You&apos;ll be matched whenever another async player queues up.</span>
                  </div>
                  <button className={styles.cancelBtn} onClick={handleCancelAsync}>Cancel</button>
                  <button className={styles.secondaryBtn} onClick={() => router.push("/asyncGames")}>
                    View Async Games
                  </button>
                </div>
              )}

              {user && asyncStatus === "matched" && (
                <div className={styles.statusBlock}>
                  <div className={styles.matchedRow}>
                    <span className={styles.successIcon}>✓</span>
                    <span className={styles.successText}>Match Found! Joining...</span>
                  </div>
                </div>
              )}

              {user && asyncStatus === "error" && (
                <div className={styles.statusBlock}>
                  <p className={styles.errorText}>{asyncErrorMessage || "Something went wrong."}</p>
                  {!asyncErrorMessage && (
                    <button className={styles.primaryBtn} onClick={handleFindAsyncMatch}>Retry</button>
                  )}
                  {asyncErrorMessage && (
                    <button className={styles.primaryBtn} onClick={() => router.push(`/profile/${user?.uid}`)}>
                      Upgrade to Premium
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Wildcard ── */}
          <div
            className={`${styles.card} ${styles.cardAccent} ${!user ? styles.signedOut : ""}`}
            style={{ "--rank-color": wildcardRankColor ?? "var(--color-primary)", "--rank-glow": wildcardRankTier?.glow ?? "transparent" } as React.CSSProperties}
          >
            <div className={styles.cardBg} aria-hidden />

            <div className={styles.cardTopRow}>
              <div className={styles.modeTag}>Mind Games</div>
              {user && (
                <div className={styles.onlineCount}>
                  <span className={styles.onlineDot} />
                  <span>{onlineCounts.wildcard} online</span>
                </div>
              )}
            </div>
            <h2 className={styles.cardTitle}>Wildcard</h2>
            <p className={styles.cardDesc}>Blitz rules, plus two bluff moves you configure before the match.</p>

            {playerInfo && (
              <div className={styles.playerSnapshot}>
                <RankBadge rating={playerInfo.ratings.wildcard ?? config.defaultRating} variant="full" premium={playerInfo.isPremium} />
              </div>
            )}

            <div className={styles.cardFooter}>
              {!user && (
                <div className={styles.statusBlock}>
                  <p className={styles.signInText}>Sign in to play.</p>
                  <button className={styles.primaryBtn} onClick={() => router.push("/login")}>
                    Sign In
                  </button>
                </div>
              )}

              {user && wildcardStatus === "idle" && (
                <button className={styles.primaryBtn} onClick={handleFindWildcardMatch}>
                  Find Match
                </button>
              )}

              {user && wildcardStatus === "searching" && (
                <div className={styles.statusBlock}>
                  <div className={styles.searchingRow}>
                    <div className={styles.spinner} />
                    <span className={styles.statusText}>Searching for opponent...</span>
                  </div>
                  <button className={styles.cancelBtn} onClick={handleCancelWildcard}>Cancel</button>
                </div>
              )}

              {user && wildcardStatus === "matched" && (
                <div className={styles.statusBlock}>
                  <div className={styles.matchedRow}>
                    <span className={styles.successIcon}>✓</span>
                    <span className={styles.successText}>Match Found! Joining...</span>
                  </div>
                </div>
              )}

              {user && wildcardStatus === "error" && (
                <div className={styles.statusBlock}>
                  <p className={styles.errorText}>Something went wrong.</p>
                  <button className={styles.primaryBtn} onClick={handleFindWildcardMatch}>Retry</button>
                </div>
              )}
            </div>
          </div>

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