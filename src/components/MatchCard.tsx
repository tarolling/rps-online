"use client";
import Link from "next/link";
import styles from "@/app/page.module.css";

export default function MatchCard({ match, index }: { match: any; index: number }) {
  return (
    <Link href={`/match/${match.id}`} key={index} className={styles.matchCard}>
      <div className={styles.matchHeader}>
        <span className={styles.matchTime}>{match.timestamp}</span>
      </div>
      <div className={styles.matchContent}>
        <Link href={`/profile/${match.playerOneId}`} onClick={(e) => e.stopPropagation()} className={styles.player}>
          {match.player1}
        </Link>
        <div className={styles.vs}>
          <span className={styles.score}>{match.score}</span>
        </div>
        <Link href={`/profile/${match.playerTwoId}`} onClick={(e) => e.stopPropagation()} className={styles.player}>
          {match.player2}
        </Link>
      </div>
      <div className={styles.matchFooter}>
        <span className={styles.winner}>Winner: {match.winner}</span>
      </div>
    </Link>
  );
}