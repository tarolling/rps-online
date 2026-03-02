import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import styles from "./MatchDetailPage.module.css";
import { getJSON } from "@/lib/api";
import { DateTime } from "neo4j-driver";
import { Choice, MatchStatus, type GameMode } from "@/types/neo4j";
import { formatTime } from "@/lib/time";
import { getAvatarUrl } from "@/lib/avatar";
import Avatar from "@/components/Avatar";
import RankBadge from "@/components/RankBadge";
import { CHOICE_EMOJI } from "@/types";

async function getGameDetail(id: string) {
  const data = await getJSON<{
    match: {
      id: string,
      timestamp: DateTime,
      totalRounds: number,
      winnerId: string,
      mode: GameMode,
      status: MatchStatus,
    },
    player1: {
      uid: string,
      username: string,
      rating: number,
      score: number,
      ratingBefore:number,
      ratingAfter:number,
      rocks:number,
      papers:number,
      scissors:number,
    },
    player2: {
      uid: string,
      username: string,
      rating: number,
      score: number,
      ratingBefore: number,
      ratingAfter: number,
      rocks: number,
      papers: number,
      scissors: number,
    },
    rounds: {
      roundNumber: number,
      p1Choice: Choice,
      p2Choice: Choice,
      winnerId: string,
    }[],
  }>("/api/fetchMatchDetail", { id });

  return {
    id: data.match.id,
    playedAt: formatTime(data.match.timestamp),
    totalRounds: data.match.totalRounds,
    winner: data.match.winnerId === data.player1.uid ? data.player1.username : data.player2.username,
    player1: {
      id: data.player1.uid,
      name: data.player1.username,
      avatar: await getAvatarUrl(data.player1.uid),
      wins: data.player1.score,
      ratingBefore: data.player1.ratingBefore,
      ratingAfter: data.player1.ratingAfter,
    },
    player2: {
      id: data.player2.uid,
      name: data.player2.username,
      avatar: await getAvatarUrl(data.player2.uid),
      wins: data.player2.score,
      ratingBefore: data.player2.ratingBefore,
      ratingAfter: data.player2.ratingAfter,
    },
    rounds: data.rounds.map((round) => ({
      round: round.roundNumber,
      p1Move: round.p1Choice,
      p2Move: round.p2Choice,
      result: round.winnerId,
    })),
  };
}

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = await getGameDetail(id);
  const { player1, player2, rounds } = game;
  const isP1Winner = game.winner === player1.name;

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>

        {/* Result Banner */}
        <section className={styles.resultBanner}>
          <div className={styles.bannerGlow} />
          <p className={styles.matchMeta}>{game.playedAt}</p>
          <div className={styles.scoreboard}>
            <div className={`${styles.playerBlock} ${isP1Winner ? styles.winner : styles.loser}`}>
              <Avatar src={player1.avatar} username={player1.name} size="lg" />
              <Link href={`/profile/${player1.id}`} className={styles.playerName}>{player1.name}</Link>
              {isP1Winner && <span className={styles.crownBadge}>👑 Winner</span>}
            </div>
            <div className={styles.scoreDisplay}>
              <span className={styles.scoreNum}>{player1.wins}</span>
              <span className={styles.scoreSep}>—</span>
              <span className={styles.scoreNum}>{player2.wins}</span>
            </div>
            <div className={`${styles.playerBlock} ${!isP1Winner ? styles.winner : styles.loser}`}>
              <Avatar src={player2.avatar} username={player2.name} size="lg" />
              <Link href={`/profile/${player2.id}`} className={styles.playerName}>{player2.name}</Link>
              {!isP1Winner && <span className={styles.crownBadge}>👑 Winner</span>}
            </div>
          </div>
        </section>

        <div className={styles.grid}>

          {/* Skill Rating */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Skill Rating</h2>
            <div className={styles.ratingRows}>
              {[
                { player: player1, won: isP1Winner },
                { player: player2, won: !isP1Winner },
              ].map(({ player, won }) => {
                const delta = player.ratingAfter - player.ratingBefore;
                return (
                  <div key={player.id} className={styles.ratingRow}>
                    <span className={styles.ratingName}>{player.name}</span>
                    <div className={styles.ratingTransition}>
                      <div className={styles.rankSnapshot}>
                        <RankBadge rating={player.ratingBefore} variant="compact" />
                        <span className={styles.ratingNum}>{player.ratingBefore}</span>
                      </div>
                      <span className={styles.ratingArrow}>→</span>
                      <div className={styles.rankSnapshot}>
                        <RankBadge rating={player.ratingAfter} variant="compact" />
                        <span className={styles.ratingNum}>{player.ratingAfter}</span>
                      </div>
                      <span className={`${styles.ratingDelta} ${won ? styles.deltaPositive : styles.deltaNegative}`}>
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Stats Comparison */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Head to Head</h2>
            <div className={styles.statRows}>
              {[
                { label: "Rounds Won", p1: player1.wins, p2: player2.wins },
                {
                  label: "Rock played",
                  p1: rounds.filter((r) => r.p1Move === Choice.Rock).length,
                  p2: rounds.filter((r) => r.p2Move === Choice.Rock).length,
                },
                {
                  label: "Paper played",
                  p1: rounds.filter((r) => r.p1Move === Choice.Paper).length,
                  p2: rounds.filter((r) => r.p2Move === Choice.Paper).length,
                },
                {
                  label: "Scissors played",
                  p1: rounds.filter((r) => r.p1Move === Choice.Scissors).length,
                  p2: rounds.filter((r) => r.p2Move === Choice.Scissors).length,
                },
              ].map(({ label, p1, p2 }) => {
                return (
                  <div key={label} className={styles.statRow}>
                    <span className={styles.statVal}>{p1}</span>
                    <div className={styles.statBarWrap}>
                      <div className={styles.statBarLeft} style={{ flexGrow: p1 }} />
                      <span className={styles.statLabel}>{label}</span>
                      <div className={styles.statBarRight} style={{ flexGrow: p2 }} />
                    </div>
                    <span className={styles.statVal}>{p2}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Round Breakdown */}
          <section className={`${styles.card} ${styles.fullWidth}`}>
            <h2 className={styles.cardTitle}>Round by Round</h2>
            <div className={styles.roundsGrid}>
              {rounds.map((round) => (
                <div
                  key={round.round}
                  className={`${styles.roundCard} ${round.result === "player1" ? styles.roundP1 :
                    round.result === "player2" ? styles.roundP2 :
                      styles.roundDraw
                  }`}
                >
                  <span className={styles.roundNum}>Round {round.round}</span>
                  <div className={styles.roundMoves}>
                    <div className={`${styles.moveBlock} ${round.result === "player1" ? styles.moveWin : ""}`}>
                      <span className={styles.moveEmoji}>{CHOICE_EMOJI[round.p1Move]}</span>
                      <span className={styles.moveText}>{round.p1Move}</span>
                    </div>
                    <span className={styles.roundVs}>vs</span>
                    <div className={`${styles.moveBlock} ${round.result === "player2" ? styles.moveWin : ""}`}>
                      <span className={styles.moveEmoji}>{CHOICE_EMOJI[round.p2Move]}</span>
                      <span className={styles.moveText}>{round.p2Move}</span>
                    </div>
                  </div>
                  <span className={styles.roundResult}>
                    {round.result === "draw" ? "Draw" :
                      round.result === "player1" ? `${player1.name} wins` :
                        `${player2.name} wins`}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Match Timeline */}
          <section className={`${styles.card} ${styles.fullWidth}`}>
            <h2 className={styles.cardTitle}>Match Timeline</h2>
            <div className={styles.timeline}>
              {rounds.map((round, i) => (
                <div key={round.round} className={styles.timelineItem}>
                  <div className={styles.timelineDot}
                    data-result={round.result === "player1" ? "win" : round.result === "player2" ? "loss" : "draw"}
                  />
                  {i < rounds.length - 1 && (
                    <div className={styles.timelineLine} />
                  )}
                  <div className={styles.timelineContent}>
                    <strong>Round {round.round}</strong>
                    <span>
                      {CHOICE_EMOJI[round.p1Move]} {round.p1Move} vs {CHOICE_EMOJI[round.p2Move]} {round.p2Move}
                      {" · "}
                      {round.result === "draw" ? "Draw" :
                        round.result === "player1" ? `${player1.name} takes it` :
                          `${player2.name} takes it`}
                    </span>
                    <span className={styles.timelineScore}>
                        Score: {rounds.slice(0, i + 1).filter((r) => r.result === "player1").length}
                      {" - "}
                      {rounds.slice(0, i + 1).filter((r) => r.result === "player2").length}
                    </span>
                  </div>
                </div>
              ))}
              <div className={styles.timelineItem}>
                <div className={styles.timelineDot} data-result="final" />
                <div className={styles.timelineContent}>
                  <strong>Match Over</strong>
                  <span>🏆 {game.winner} wins {player1.wins}-{player2.wins}</span>
                </div>
              </div>
            </div>
          </section>

        </div>

        <div className={styles.actions}>
          <Link href="/dashboard" className={styles.btnPrimary}>Play Again</Link>
          <Link href="/leaderboard" className={styles.btnSecondary}>Leaderboard</Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}