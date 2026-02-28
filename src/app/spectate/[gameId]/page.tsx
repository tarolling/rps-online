"use client";

import { getDatabase, onDisconnect, onValue, ref, remove, set } from "firebase/database";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAvatarUrl } from "@/lib/avatar";
import { getJSON } from "@/lib/api";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import RankBadge from "@/components/RankBadge";
import Avatar from "@/components/Avatar";
import styles from "@/styles/game.module.css";
import config from "@/config/settings.json";
import { Game, RoundData, UserClub } from "@/types";
import { Choice, MatchStatus } from "@/types/neo4j";

const CHOICE_EMOJI: Record<string, string> = {
  [Choice.Rock]: "✊",
  [Choice.Paper]: "✋",
  [Choice.Scissors]: "✌️",
};

export default function SpectatePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const router = useRouter();
  const db = getDatabase();

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(config.roundTimeout);
  const [p1AvatarUrl, setP1AvatarUrl] = useState<string | null>(null);
  const [p2AvatarUrl, setP2AvatarUrl] = useState<string | null>(null);
  const [clubTags, setClubTags] = useState<Record<string, string | null>>({});

  // Subscribe to game
  useEffect(() => {
    if (!gameId) return;
    const gameRef = ref(db, `games/${gameId}`);
    const unsub = onValue(gameRef, (snapshot) => {
      setLoading(false);
      const data: Game = snapshot.val();
      if (!data || !data.player1 || !data.player2) return;
      setGame(data);
    });
    return () => unsub();
  }, [gameId]);

  // Timer (display-only)
  useEffect(() => {
    if (!game?.roundStartTimestamp || game.state !== MatchStatus.InProgress) return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - game.roundStartTimestamp!) / 1000);
      setTimeLeft(Math.max(0, config.roundTimeout - elapsed));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [game?.roundStartTimestamp, game?.state]);

  // Fetch avatars & clubs
  useEffect(() => {
    if (!game) return;
    getAvatarUrl(game.player1.id).then(setP1AvatarUrl);
    getAvatarUrl(game.player2.id).then(setP2AvatarUrl);
    Promise.all([
      getJSON<UserClub>("/api/clubs/user", { uid: game.player1.id }).catch(() => null),
      getJSON<UserClub>("/api/clubs/user", { uid: game.player2.id }).catch(() => null),
    ]).then(([c1, c2]) => setClubTags({
      [game.player1.id]: c1?.tag ?? null,
      [game.player2.id]: c2?.tag ?? null,
    }));
  }, [game?.player1.id, game?.player2.id]);

  /* Add to list of spectators */
  useEffect(() => {
    if (!gameId) return;
    const db = getDatabase();
    // Use a random ID so unauthenticated visitors count too
    const spectatorId = crypto.randomUUID();
    const spectatorRef = ref(db, `games/${gameId}/spectators/${spectatorId}`);

    const connectedRef = ref(db, ".info/connected");
    const unsub = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        set(spectatorRef, true).then(() => {
          onDisconnect(spectatorRef).remove();
        });
      }
    });

    return () => {
      unsub();
      remove(spectatorRef);
    };
  }, [gameId]);

  const wrap = (children: React.ReactNode) => (
    <div className="app">
      <Header />
      <main className={styles.main}>
        <div className={styles.gameContainer}>{children}</div>
      </main>
      <Footer />
    </div>
  );

  if (loading) return wrap(<p className={styles.loading}>Loading match...</p>);
  if (!game) return wrap(
    <div className={styles.result}>
      <p className={styles.errorText}>Match not found or has ended.</p>
      <button className={styles.playAgainButton} onClick={() => router.push("/")}>Return Home</button>
    </div>,
  );
  if (game.state === MatchStatus.Waiting) return wrap(<p className={styles.loading}>Match hasn&#39;t started yet...</p>);
  if (game.state === MatchStatus.Completed || game.state === MatchStatus.Cancelled) {
    const winnerName = game.winner === game.player1.id ? game.player1.username : game.player2.username;
    return wrap(
      <div className={styles.result}>
        <p className={styles.resultLabel}>Match Over</p>
        {game.winner && <p className={`${styles.finalScore}`}>🏆 {winnerName} wins!</p>}
        <p className={styles.finalScore}>{game.player1.score} - {game.player2.score}</p>
        <button className={styles.playAgainButton} onClick={() => router.push("/")}>Return Home</button>
      </div>,
    );
  }

  const bothSubmitted = game.player1.submitted && game.player2.submitted;

  return wrap(
    <>
      <div className={styles.spectatorBanner}>👁️ Spectating</div>

      <div className={styles.scoreboard}>
        {/* Player 1 */}
        <SpectatorPanel
          label={game.player1.username}
          name={game.player1.username}
          rating={game.player1.rating}
          score={game.player1.score}
          clubTag={clubTags[game.player1.id]}
          avatarUrl={p1AvatarUrl}
          hasChosen={game.player1.submitted}
          choice={bothSubmitted ? game.player1.choice : null}
          reveal={bothSubmitted}
        />

        <div className={styles.vsBlock}>
          <span className={styles.roundLabel}>Round</span>
          <span className={styles.roundNumber}>{game.currentRound}</span>
          <div className={`${styles.timer} ${timeLeft <= 10 ? styles.timerWarning : ""}`}>
            {timeLeft}s
          </div>
        </div>

        {/* Player 2 */}
        <SpectatorPanel
          label={game.player2.username}
          name={game.player2.username}
          rating={game.player2.rating}
          score={game.player2.score}
          clubTag={clubTags[game.player2.id]}
          avatarUrl={p2AvatarUrl}
          hasChosen={game.player2.submitted}
          choice={bothSubmitted ? game.player2.choice : null}
          reveal={bothSubmitted}
        />
      </div>

      {game.rounds && Object.keys(game.rounds).length > 0 && (
        <RoundHistory rounds={game.rounds} />
      )}
    </>,
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SpectatorPanel({ label, name, rating, score, clubTag, avatarUrl, hasChosen, choice, reveal }: {
  label: string; name: string; rating: number; score: number;
  clubTag?: string | null; avatarUrl?: string | null;
  hasChosen: boolean; choice: Choice | null; reveal: boolean;
}) {
  return (
    <div className={styles.playerPanel}>
      <span className={styles.playerLabel}>{label}</span>
      <Avatar src={avatarUrl} username={name} size="md" />
      <span className={styles.playerName}>
        {clubTag && <span className={styles.playerClubTag}>[{clubTag}]</span>} {name}
      </span>
      <RankBadge rating={rating} variant="compact" />
      <span className={styles.playerScore}>{score}</span>
      <div className={`${styles.choiceDisplay} ${hasChosen || (choice && reveal) ? styles.choiceVisible : ""}`}>
        {choice && reveal ? CHOICE_EMOJI[choice] : hasChosen ? "✔️" : ""}
      </div>
    </div>
  );
}

function RoundHistory({ rounds }: { rounds: Record<number, RoundData> }) {
  const entries = Object.entries(rounds).sort(([a], [b]) => Number(a) - Number(b));
  return (
    <div className={styles.roundHistory}>
      <div className={styles.roundHistoryHeader}>
        <span>Player 1</span>
        <span />
        <span>Player 2</span>
      </div>
      {entries.map(([round, data]) => {
        const outcome = data.winner === "player1" ? "win" : data.winner === "draw" ? "draw" : "loss";
        return (
          <div key={round} className={`${styles.roundHistoryRow} ${styles[outcome]}`}>
            <span>{data.player1Choice === null ? "⏱️" : CHOICE_EMOJI[data.player1Choice]}</span>
            <span className={styles.roundHistoryLabel}>R{round}</span>
            <span>{data.player2Choice === null ? "⏱️" : CHOICE_EMOJI[data.player2Choice]}</span>
          </div>
        );
      })}
    </div>
  );
}