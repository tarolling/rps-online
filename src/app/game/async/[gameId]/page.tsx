"use client";

import { getDatabase, onValue, ref } from "firebase/database";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import styles from "@/styles/game.module.css";
import config from "@/config/settings.json";
import { getAvatarUrl } from "@/lib/avatar";
import { postJSON } from "@/lib/api";
import { formatCountdown } from "@/lib/time";
import { CHOICE_EMOJI, Game } from "@/types";
import { Choice, MatchStatus } from "@/types/neo4j";
import { PlayerPanel, RoundHistory } from "@/components/GamePanels";

// ── Constants ─────────────────────────────────────────────────────────────────

const PLAYABLE_CHOICES = [Choice.Rock, Choice.Paper, Choice.Scissors];
// Just needs to be frequent enough that the "time remaining" text doesn't go stale.
const COUNTDOWN_REFRESH_MS = 30_000;

// ── Component ─────────────────────────────────────────────────────────────────

function AsyncGamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const db = getDatabase();

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [playerAvatarUrl, setPlayerAvatarUrl] = useState<string | null>(null);
  const [opponentAvatarUrl, setOpponentAvatarUrl] = useState<string | null>(null);

  const playerId = user?.uid;
  const isPlayer1 = game?.player1.id === playerId;
  const playerData = isPlayer1 ? game?.player1 : game?.player2;
  const opponentData = isPlayer1 ? game?.player2 : game?.player1;
  const opponentKey = isPlayer1 ? "player2" : "player1";

  // Subscribe to game state — resolution happens server-side (submit + cron backstop),
  // this page only ever reads.
  useEffect(() => {
    if (!gameId || !playerId) return;

    const gameRef = ref(db, `games/${gameId}`);
    const unsubscribe = onValue(gameRef, (snapshot) => {
      const data: Game = snapshot.val();
      setLoading(false);
      if (!data || !data.player1 || !data.player2) {
        setGame(null);
        return;
      }

      setGame((prev) => {
        if (data.currentRound !== prev?.currentRound) setChoice(null);
        return data;
      });
    });

    return () => unsubscribe();
  }, [gameId, playerId]);

  // Fetch avatars once we know both player IDs
  useEffect(() => {
    if (!playerId || !game) return;
    const opponentId = isPlayer1 ? game.player2.id : game.player1.id;
    getAvatarUrl(playerId).then(setPlayerAvatarUrl);
    getAvatarUrl(opponentId).then(setOpponentAvatarUrl);
  }, [playerId, game?.player1.id, game?.player2.id]);

  // Periodically refresh the "time remaining" display
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), COUNTDOWN_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const makeChoice = useCallback(async (selected: Choice) => {
    if (choice || !gameId || game?.state !== MatchStatus.InProgress) return;
    setChoice(selected);
    setSubmitting(true);
    try {
      await postJSON("/api/games/submitChoice", { gameId, choice: selected });
    } catch (err) {
      console.error("Error submitting choice:", err);
      setChoice(null);
    } finally {
      setSubmitting(false);
    }
  }, [choice, game?.state, gameId]);

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
            <button className={styles.playAgainButton} onClick={() => router.push("/asyncGames")}>
              Back to Async Games
            </button>
          </div>
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
            <p className={styles.hint}>Neither player responded in time.</p>
            <button className={styles.playAgainButton} onClick={() => router.push("/asyncGames")}>
              Back to Async Games
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );

  const isFinished = game.state === MatchStatus.Completed;
  const playerWon = game.winner === playerId;
  const roundDeadlineMs = (game.roundStartTimestamp ?? now) + (game.roundDurationSeconds ?? config.async.roundTimeoutSeconds) * 1000;

  return (
    <div className="app">
      <Header />
      <main className={styles.main}>
        <div className={styles.gameContainer}>

          {/* Scoreboard */}
          <div className={styles.scoreboard}>
            <PlayerPanel
              label="You"
              name={playerData?.username ?? "Player"}
              rating={playerData?.rating ?? 0}
              score={playerData?.score ?? 0}
              choice={choice}
              avatarUrl={playerAvatarUrl}
            />

            <div className={styles.vsBlock}>
              <span className={styles.roundLabel}>Round</span>
              <span className={styles.roundNumber}>{game.currentRound}</span>
              {!isFinished && (
                <div className={styles.timer}>
                  {formatCountdown(roundDeadlineMs, now)}
                </div>
              )}
            </div>

            <PlayerPanel
              label="Opponent"
              name={opponentData?.username ?? "Opponent"}
              rating={opponentData?.rating ?? 0}
              score={opponentData?.score ?? 0}
              choice={null}
              reveal={false}
              hasChosen={!!game[opponentKey].submitted}
              avatarUrl={opponentAvatarUrl}
            />
          </div>

          {/* Choices */}
          {!isFinished && (
            <div className={styles.choices}>
              {PLAYABLE_CHOICES.map((c) => (
                <button
                  key={c}
                  onClick={() => makeChoice(c)}
                  disabled={!!choice || submitting}
                  className={`${styles.choiceButton} ${choice === c ? styles.selected : ""}`}
                >
                  <span className={styles.choiceEmoji}>{CHOICE_EMOJI[c]}</span>
                  <span className={styles.choiceLabel}>{c}</span>
                </button>
              ))}
            </div>
          )}
          {choice && !isFinished && (
            <p className={styles.hint}>Choice locked in. Waiting on your opponent (or the deadline).</p>
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
              <button className={styles.playAgainButton} onClick={() => router.push("/asyncGames")}>
                Back to Async Games
              </button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AsyncGamePage;
