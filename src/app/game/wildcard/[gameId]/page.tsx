"use client";

import { get, getDatabase, onValue, ref, remove, set, update } from "firebase/database";
import { onDisconnect } from "firebase/database";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { DISCONNECT_TIMEOUT, WAITING_TIMEOUT } from "@/lib/common";
import { resolveRound, awardWinByDisconnect } from "@/lib/matchmaking";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import styles from "@/styles/game.module.css";
import config from "@/config/settings.json";
import { getAvatarUrl } from "@/lib/avatar";
import { getJSON } from "@/lib/api";
import { CHOICE_EMOJI, Game, UserClub } from "@/types";
import { Choice, MatchStatus } from "@/types/neo4j";
import { PlayerPanel, RoundHistory } from "@/components/GamePanels";

// ── Constants ─────────────────────────────────────────────────────────────────

const PLAYABLE_CHOICES = [Choice.Rock, Choice.Paper, Choice.Scissors, Choice.WildcardA, Choice.WildcardB];
const PLAIN_CHOICES = [Choice.Rock, Choice.Paper, Choice.Scissors];

// Friendlier labels than the raw enum values (WILDCARD_A/WILDCARD_B read poorly on a button).
const CHOICE_LABEL: Record<Choice, string> = {
  [Choice.Rock]: "Rock",
  [Choice.Paper]: "Paper",
  [Choice.Scissors]: "Scissors",
  [Choice.WildcardA]: "A",
  [Choice.WildcardB]: "B",
};

// ── Component ─────────────────────────────────────────────────────────────────
// Wildcard is live/client-driven like Blitz (not server-authoritative like
// Async) — no bots in v1, so unlike game/[gameId]/page.tsx this page has no
// bot-play wiring or bot-disconnect handling.

function WildcardGamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const db = getDatabase();

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [roundOver, setRoundOver] = useState(false);
  const [timeLeft, setTimeLeft] = useState(config.wildcard.roundTimeoutSeconds);
  const [opponentConnected, setOpponentConnected] = useState(true);
  const [playerAvatarUrl, setPlayerAvatarUrl] = useState<string | null>(null);
  const [opponentAvatarUrl, setOpponentAvatarUrl] = useState<string | null>(null);
  const [clubTags, setClubTags] = useState<Record<string, string | null>>({});
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [selectedConfig, setSelectedConfig] = useState<Choice[]>([]);
  const [configSubmitted, setConfigSubmitted] = useState(false);
  // Frozen until the round resolves, so the opponent's live abRemaining decrement
  // (written the instant they submit) can't be used to infer they played A/B early.
  const [displayedOpponentAB, setDisplayedOpponentAB] = useState<number | null>(null);

  const playerId = user?.uid;
  const isPlayer1 = game?.player1.id === playerId;
  const playerData = isPlayer1 ? game?.player1 : game?.player2;
  const opponentData = isPlayer1 ? game?.player2 : game?.player1;
  const opponentKey = isPlayer1 ? "player2" : "player1";

  // Single ref to track per-round handling - mutations are synchronous so no stale closure issues
  const handledRound = useRef<{ round: number; resolveFired: boolean } | null>(null);

  // Fetch avatars once we know both player IDs
  useEffect(() => {
    if (!playerId || !game) return;
    const opponentId = isPlayer1 ? game.player2.id : game.player1.id;
    getAvatarUrl(playerId).then(setPlayerAvatarUrl);
    getAvatarUrl(opponentId).then(setOpponentAvatarUrl);

    if (!clubTags[game.player1.id] && !clubTags[game.player2.id]) {
      Promise.all([
        getJSON<UserClub>("/api/clubs/user", { uid: game.player1.id }).catch(() => null),
        getJSON<UserClub>("/api/clubs/user", { uid: game.player2.id }).catch(() => null),
      ]).then(([p1Club, p2Club]) => {
        setClubTags({
          [game.player1.id]: p1Club?.tag ?? null,
          [game.player2.id]: p2Club?.tag ?? null,
        });
      });
    }
  }, [playerId, game?.player1.id, game?.player2.id]);

  // Server-anchored round timer - auto-submits when it hits zero. Doesn't run
  // during configPhase — roundStartTimestamp isn't set until config is done.
  useEffect(() => {
    if (!game) return;
    if (game.state !== MatchStatus.InProgress || game.configPhase || !game.roundStartTimestamp) return;
    const resolverPlayerId = game.player1.id;
    const iAmResolver = isPlayer1;
    const roundDurationSeconds = game.roundDurationSeconds ?? config.wildcard.roundTimeoutSeconds;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - game.roundStartTimestamp!) / 1000);
      const remaining = Math.max(0, roundDurationSeconds - elapsed);
      setTimeLeft(remaining);
      if (remaining === 0 && iAmResolver) resolveRound(gameId, resolverPlayerId);
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [game?.roundStartTimestamp, game?.state, game?.configPhase, game?.player1.id]);

  // Subscribe to game state
  useEffect(() => {
    if (!gameId || !playerId) return;

    const gameRef = ref(db, `games/${gameId}`);
    const unsubscribe = onValue(gameRef, (snapshot) => {
      const data: Game = snapshot.val();
      setLoading(false);
      if (!data) return;
      if (!data.player1 || !data.player2) return;
      if (data.state === MatchStatus.Cancelled) {
        setGame(data);
        remove(ref(db, `games/${gameId}`));
        return;
      }

      setGame((prev) => {
        if (data.currentRound !== prev?.currentRound) {
          setChoice(null);
          setTimeLeft(data.roundDurationSeconds ?? config.wildcard.roundTimeoutSeconds);
          setRoundOver(false);
          const oppKey = playerId === data.player1.id ? "player2" : "player1";
          setDisplayedOpponentAB(data[oppKey]?.abRemaining ?? config.wildcard.abStartingPoints);
          handledRound.current = { round: data.currentRound, resolveFired: false };
        }
        return data;
      });

      if (!handledRound.current) {
        handledRound.current = { round: data.currentRound, resolveFired: false };
      }

      const handled = handledRound.current;
      const resolverPlayerId = data.player1.id;
      const iAmResolver = playerId === resolverPlayerId;

      if (
        data.player1.submitted &&
                data.player2.submitted &&
                data.state === MatchStatus.InProgress &&
                !handled.resolveFired
      ) {
        handled.resolveFired = true;
        setRoundOver(true);
        const oppKey = playerId === data.player1.id ? "player2" : "player1";
        setDisplayedOpponentAB(data[oppKey]?.abRemaining ?? config.wildcard.abStartingPoints);
        if (iAmResolver) setTimeout(() => resolveRound(gameId, resolverPlayerId), 1000);
      }
    });

    return () => unsubscribe();
  }, [gameId, playerId]);

  // Set presence once on mount, never clean it up early
  useEffect(() => {
    if (!gameId || !playerId) return;
    const presenceRef = ref(db, `games/${gameId}/presence/${playerId}`);

    const connectedRef = ref(db, ".info/connected");
    const unsubConnected = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        set(presenceRef, true).then(() => {
          onDisconnect(presenceRef).remove();
        });
      }
    });

    return () => {
      unsubConnected();
      remove(presenceRef);
    };
  }, [gameId, playerId]);

  // Separate effect just for starting the game (presence -> InProgress). Unlike
  // Blitz, this does NOT set roundStartTimestamp — that only happens once both
  // players have submitted their pregame A-config (see the effect below).
  useEffect(() => {
    if (!gameId || !playerId) return;

    const presenceRootRef = ref(db, `games/${gameId}/presence`);
    const unsubPresence = onValue(presenceRootRef, async (snapshot) => {
      const presence = snapshot.val() ?? {};

      const gameSnap = await get(ref(db, `games/${gameId}`));
      const currentGame = gameSnap.val();

      if (!currentGame || currentGame.state !== MatchStatus.Waiting) return;

      if (
        currentGame.player1.id &&
                currentGame.player2.id &&
                presence[currentGame.player1.id] &&
                presence[currentGame.player2.id]
      ) {
        const iAmPlayer1 = playerId === currentGame.player1.id;
        if (iAmPlayer1) {
          await update(ref(db, `games/${gameId}`), {
            state: MatchStatus.InProgress,
          });
        }
      }
    });

    return () => unsubPresence();
  }, [gameId, playerId]);

  // Once both players have submitted their pregame A-config, start round 1's
  // timer. Player1's client owns this transition, same convention used for
  // presence -> InProgress and round-timeout resolution.
  useEffect(() => {
    if (!game || !isPlayer1) return;
    if (game.state !== MatchStatus.InProgress || !game.configPhase) return;
    if (game.player1.aBeats && game.player2.aBeats) {
      update(ref(db, `games/${gameId}`), {
        configPhase: false,
        roundStartTimestamp: Date.now(),
      });
    }
  }, [game?.player1.aBeats, game?.player2.aBeats, game?.state, game?.configPhase, isPlayer1, gameId]);

  /* Spectator Count */
  useEffect(() => {
    if (!gameId) return;
    const spectatorRef = ref(db, `games/${gameId}/spectators`);
    const unsub = onValue(spectatorRef, (snap) => {
      setSpectatorCount(snap.exists() ? Object.keys(snap.val()).length : 0);
    });
    return () => unsub();
  }, [gameId]);

  // watch opponent's presence for disconnects
  useEffect(() => {
    if (!gameId || !playerId || !game) return;
    if (game.state !== MatchStatus.InProgress && game.state !== MatchStatus.Waiting) return;

    const opponentId = isPlayer1 ? game.player2.id : game.player1.id;
    const opponentPresenceRef = ref(db, `games/${gameId}/presence/${opponentId}`);
    let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = onValue(opponentPresenceRef, (snapshot) => {
      const connected = snapshot.exists();
      setOpponentConnected(connected);
      if (!connected) {
        const timeout = game.state === MatchStatus.Waiting ? WAITING_TIMEOUT * 1000 : DISCONNECT_TIMEOUT * 1000;
        disconnectTimer = setTimeout(async () => {
          const myPresence = await get(ref(db, `games/${gameId}/presence/${playerId}`));
          if (!myPresence.exists()) {
            await update(ref(db, `games/${gameId}`), { state: MatchStatus.Cancelled });
          } else {
            awardWinByDisconnect(gameId, playerId);
          }
        }, timeout);
      } else {
        if (disconnectTimer) {
          clearTimeout(disconnectTimer);
          disconnectTimer = null;
        }
      }
    });

    return () => {
      unsubscribe();
      if (disconnectTimer) clearTimeout(disconnectTimer);
    };
  }, [gameId, playerId, game?.state]);

  const toggleConfigChoice = useCallback((c: Choice) => {
    setSelectedConfig((prev) => {
      if (prev.includes(c)) return prev.filter((x) => x !== c);
      if (prev.length >= 2) return prev;
      return [...prev, c];
    });
  }, []);

  const submitConfig = useCallback(async () => {
    if (selectedConfig.length !== 2 || !game) return;
    setConfigSubmitted(true);
    const playerKey = isPlayer1 ? "player1" : "player2";
    try {
      await update(ref(db, `games/${gameId}`), {
        [`${playerKey}/aBeats`]: selectedConfig,
        [`${playerKey}/abRemaining`]: config.wildcard.abStartingPoints,
      });
    } catch (err) {
      console.error("Error submitting Wildcard config:", err);
      setConfigSubmitted(false);
    }
  }, [selectedConfig, game, isPlayer1, gameId]);

  const makeChoice = useCallback(async (selected: Choice | null) => {
    if (choice || game?.state !== MatchStatus.InProgress || game.configPhase) return;
    const isAB = selected === Choice.WildcardA || selected === Choice.WildcardB;
    if (isAB && (playerData?.abRemaining ?? 0) <= 0) return;
    setChoice(selected);

    const playerKey = isPlayer1 ? "player1" : "player2";
    try {
      await update(ref(db, `games/${gameId}`), {
        [`${playerKey}/choice`]: selected,
        [`${playerKey}/submitted`]: true,
        ...(isAB && { [`${playerKey}/abRemaining`]: (playerData?.abRemaining ?? config.wildcard.abStartingPoints) - 1 }),
      });
    } catch (err) {
      console.error("Error making choice:", err);
      setChoice(null);
    }
  }, [choice, game?.state, game?.configPhase, isPlayer1, gameId, playerData?.abRemaining]);

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="app">
      <Header />
      <main className={styles.main}>
        <div className={styles.gameContainer}>
          <p className={styles.loading}>Loading game...</p>
        </div>
      </main>
      <Footer />
    </div>
  );

  if (!game) return (
    <div className="app">
      <Header />
      <main className={styles.main}>
        <div className={styles.gameContainer}>
          <div className={styles.result}>
            <p className={styles.errorText}>Game not found.</p>
            <button className={styles.playAgainButton} onClick={() => router.push("/")}>
                            Return Home
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );

  if (game.state === MatchStatus.Waiting) return (
    <div className="app">
      <Header />
      <main className={styles.main}>
        <div className={styles.gameContainer}>
          <p className={styles.loading}>Waiting for opponent to connect...</p>
        </div>
      </main>
      <Footer />
    </div>
  );

  if (game.state === MatchStatus.Cancelled) return (
    <div className="app">
      <Header />
      <main className={styles.main}>
        <div className={styles.gameContainer}>
          <div className={styles.result}>
            <p className={styles.resultLabel}>Game Cancelled</p>
            <p className={styles.hint}>Both players disconnected.</p>
            <button className={styles.playAgainButton} onClick={() => router.push("/play")}>
              Play Again
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );

  const isFinished = game.state === MatchStatus.Completed;
  const playerWon = game.winner === playerId;

  return (
    <div className="app">
      <Header />
      <main className={styles.main}>
        <div className={styles.gameContainer}>

          {game.configPhase ? (
            <div className={styles.result}>
              <p className={styles.resultLabel}>Choose Your Wildcard</p>
              <p className={styles.hint}>
                Pick 2 of Rock/Paper/Scissors — these are what your Wildcard-A will beat.
                The one you don&apos;t pick beats your A instead, and B always beats A.
              </p>
              <div className={styles.choices}>
                {PLAIN_CHOICES.map((c) => (
                  <button
                    key={c}
                    onClick={() => toggleConfigChoice(c)}
                    disabled={configSubmitted}
                    className={`${styles.choiceButton} ${selectedConfig.includes(c) ? styles.selected : ""}`}
                  >
                    <span className={styles.choiceEmoji}>{CHOICE_EMOJI[c]}</span>
                    <span className={styles.choiceLabel}>{CHOICE_LABEL[c]}</span>
                  </button>
                ))}
              </div>
              <button
                className={styles.playAgainButton}
                disabled={selectedConfig.length !== 2 || configSubmitted}
                onClick={submitConfig}
              >
                {configSubmitted ? "Waiting for opponent…" : "Confirm"}
              </button>
            </div>
          ) : (
            <>
              {/* Scoreboard */}
              <div className={styles.scoreboard}>
                <PlayerPanel
                  label="You"
                  name={playerData?.username ?? "Player"}
                  clubTag={playerData ? clubTags[playerData.id] : null}
                  rating={playerData?.rating ?? 0}
                  score={playerData?.score ?? 0}
                  choice={choice}
                  avatarUrl={playerAvatarUrl}
                />

                <div className={styles.vsBlock}>
                  <span className={styles.roundLabel}>Round</span>
                  <span className={styles.roundNumber}>{game.currentRound}</span>
                  <div className={`${styles.timer} ${timeLeft <= 10 ? styles.timerWarning : ""}`}>
                    {timeLeft}s
                  </div>
                  {spectatorCount > 0 && (
                    <span className={styles.spectatorCount}>
                      👁️ {spectatorCount}
                    </span>
                  )}
                </div>

                <PlayerPanel
                  label="Opponent"
                  name={opponentData?.username ?? "Opponent"}
                  clubTag={opponentData ? clubTags[opponentData.id] : null}
                  rating={opponentData?.rating ?? 0}
                  score={opponentData?.score ?? 0}
                  choice={roundOver ? game[opponentKey].choice : null}
                  reveal={roundOver}
                  hasChosen={!!game[opponentKey].choice}
                  disconnected={!opponentConnected}
                  avatarUrl={opponentAvatarUrl}
                />
              </div>

              {!isFinished && (
                <div className={styles.wildcardPoints}>
                  <span>Your Wildcard plays left: <strong>{playerData?.abRemaining ?? 0}</strong></span>
                  <span>Opponent&apos;s left: <strong>{displayedOpponentAB ?? config.wildcard.abStartingPoints}</strong></span>
                </div>
              )}

              {/* Choices */}
              {!isFinished && (
                <div className={styles.choices}>
                  {PLAYABLE_CHOICES.map((c) => {
                    const isAB = c === Choice.WildcardA || c === Choice.WildcardB;
                    const disabled = !!choice || (isAB && (playerData?.abRemaining ?? 0) <= 0);
                    return (
                      <button
                        key={c}
                        onClick={() => makeChoice(c)}
                        disabled={disabled}
                        className={`${styles.choiceButton} ${choice === c ? styles.selected : ""}`}
                      >
                        <span className={styles.choiceEmoji}>{CHOICE_EMOJI[c]}</span>
                        <span className={styles.choiceLabel}>{CHOICE_LABEL[c]}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Round History */}
              {game.rounds && Object.keys(game.rounds).length > 0 && (
                <RoundHistory rounds={game.rounds} isPlayer1={isPlayer1} />
              )}

              {/* Result */}
              {isFinished && (
                <div className={styles.result}>
                  <p className={`${styles.resultLabel} ${playerWon ? styles.victory : styles.defeat}`}>
                    {playerWon ? "Victory!" : "Defeat"}
                  </p>
                  <p className={styles.finalScore}>
                    {playerData?.score} - {opponentData?.score}
                  </p>
                  <button className={styles.playAgainButton} onClick={() => router.push("/play")}>
                    Play Again
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default WildcardGamePage;
