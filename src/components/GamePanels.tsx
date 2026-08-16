import styles from "@/styles/game.module.css";
import RankBadge from "@/components/RankBadge";
import Avatar from "@/components/Avatar";
import { CHOICE_EMOJI, RoundData } from "@/types";
import { Choice } from "@/types/neo4j";

type PlayerPanelProps = {
    label: string;
    name: string;
    rating: number;
    score: number;
    choice: Choice | null;
    clubTag?: string | null;
    avatarUrl?: string | null;
    reveal?: boolean;
    hasChosen?: boolean;
    disconnected?: boolean;
};

export function PlayerPanel({ label, name, rating, score, choice, avatarUrl, clubTag, reveal = true, hasChosen = false, disconnected = false }: PlayerPanelProps) {
  return (
    <div className={styles.playerPanel}>
      <span className={styles.playerLabel}>{label}</span>
      <Avatar src={avatarUrl} username={name} size="md" />
      <span className={styles.playerName}>
        {clubTag && <span className={styles.playerClubTag}>[{clubTag}]</span>} {name} {disconnected && <span className={styles.disconnectedBadge}>● Disconnected</span>}
      </span>
      <RankBadge rating={rating} variant='compact' />
      <span className={styles.playerScore}>{score}</span>
      <div className={`${styles.choiceDisplay} ${(choice && reveal) || hasChosen ? styles.choiceVisible : ""}`}>
        {choice && reveal ? CHOICE_EMOJI[choice] : hasChosen ? "✔️" : ""}
      </div>
    </div>
  );
}

export function RoundHistory({ rounds, isPlayer1 }: { rounds: Record<number, RoundData>; isPlayer1: boolean }) {
  const entries = Object.entries(rounds).sort(([a], [b]) => Number(a) - Number(b));

  return (
    <div className={styles.roundHistory}>
      <div className={styles.roundHistoryHeader}>
        <span>You</span>
        <span />
        <span>Opponent</span>
      </div>
      {entries.map(([round, data]) => {
        const myChoice = isPlayer1 ? data.player1Choice : data.player2Choice;
        const theirChoice = isPlayer1 ? data.player2Choice : data.player1Choice;
        const myKey = isPlayer1 ? "player1" : "player2";
        const outcome = data.winner === myKey ? "win" : data.winner === "draw" ? "draw" : "loss";

        return (
          <div key={round} className={`${styles.roundHistoryRow} ${styles[outcome]}`}>
            <span>{myChoice === null ? "⏱️" : CHOICE_EMOJI[myChoice]}</span>
            <span className={styles.roundHistoryLabel}>R{round}</span>
            <span>{theirChoice === null ? "⏱️" : CHOICE_EMOJI[theirChoice]}</span>
          </div>
        );
      })}
    </div>
  );
}
