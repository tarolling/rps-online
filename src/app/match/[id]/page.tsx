import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import styles from "./MatchDetailPage.module.css";

// Replace with real fetch
async function getGameDetail(id: string) {
    return {
        id,
        playedAt: "February 27, 2026 · 3:42 PM",
        totalRounds: 5,
        winner: "shadowfist99",
        player1: {
            id: "p1",
            name: "shadowfist99",
            avatar: "🥷",
            wins: 3,
            ratingBefore: 1420,
            ratingAfter: 1451,
        },
        player2: {
            id: "p2",
            name: "rocksolid42",
            avatar: "🪨",
            wins: 2,
            ratingBefore: 1388,
            ratingAfter: 1361,
        },
        rounds: [
            { round: 1, p1Move: "✊", p2Move: "✌️", result: "p1" },
            { round: 2, p1Move: "🖐️", p2Move: "✊", result: "p1" },
            { round: 3, p1Move: "✌️", p2Move: "🖐️", result: "p2" },
            { round: 4, p1Move: "✊", p2Move: "✊", result: "draw" },
            { round: 5, p1Move: "✌️", p2Move: "✊", result: "p1" },
        ],
    };
}

const moveLabel: Record<string, string> = {
    "✊": "Rock",
    "🖐️": "Paper",
    "✌️": "Scissors",
};

export default async function MatchDetailPage({ params }: { params: { id: string } }) {
    const game = await getGameDetail(params.id);
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
                            <span className={styles.avatar}>{player1.avatar}</span>
                            <span className={styles.playerName}>{player1.name}</span>
                            {isP1Winner && <span className={styles.crownBadge}>👑 Winner</span>}
                        </div>
                        <div className={styles.scoreDisplay}>
                            <span className={styles.scoreNum}>{player1.wins}</span>
                            <span className={styles.scoreSep}>—</span>
                            <span className={styles.scoreNum}>{player2.wins}</span>
                        </div>
                        <div className={`${styles.playerBlock} ${!isP1Winner ? styles.winner : styles.loser}`}>
                            <span className={styles.avatar}>{player2.avatar}</span>
                            <span className={styles.playerName}>{player2.name}</span>
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
                                        <span className={styles.ratingName}>{player.avatar} {player.name}</span>
                                        <div className={styles.ratingBar}>
                                            <div className={styles.ratingTrack}>
                                                <div
                                                    className={styles.ratingFill}
                                                    style={{ width: `${Math.min((player.ratingBefore / 2000) * 100, 100)}%` }}
                                                />
                                            </div>
                                            <span className={styles.ratingValue}>{player.ratingBefore}</span>
                                        </div>
                                        <span className={`${styles.ratingDelta} ${won ? styles.deltaPositive : styles.deltaNegative}`}>
                                            {delta > 0 ? `+${delta}` : delta} → {player.ratingAfter}
                                        </span>
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
                                { label: "Rounds Won", p1: player1.wins, p2: player2.wins, total: game.totalRounds },
                                {
                                    label: "Rock played",
                                    p1: rounds.filter(r => r.p1Move === "✊").length,
                                    p2: rounds.filter(r => r.p2Move === "✊").length,
                                    total: game.totalRounds,
                                },
                                {
                                    label: "Paper played",
                                    p1: rounds.filter(r => r.p1Move === "🖐️").length,
                                    p2: rounds.filter(r => r.p2Move === "🖐️").length,
                                    total: game.totalRounds,
                                },
                                {
                                    label: "Scissors played",
                                    p1: rounds.filter(r => r.p1Move === "✌️").length,
                                    p2: rounds.filter(r => r.p2Move === "✌️").length,
                                    total: game.totalRounds,
                                },
                            ].map(({ label, p1, p2, total }) => (
                                <div key={label} className={styles.statRow}>
                                    <span className={styles.statVal}>{p1}</span>
                                    <div className={styles.statBarWrap}>
                                        <div className={styles.statBarLeft} style={{ width: `${(p1 / total) * 100}%` }} />
                                        <span className={styles.statLabel}>{label}</span>
                                        <div className={styles.statBarRight} style={{ width: `${(p2 / total) * 100}%` }} />
                                    </div>
                                    <span className={styles.statVal}>{p2}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Round Breakdown */}
                    <section className={`${styles.card} ${styles.fullWidth}`}>
                        <h2 className={styles.cardTitle}>Round by Round</h2>
                        <div className={styles.roundsGrid}>
                            {rounds.map((round) => (
                                <div
                                    key={round.round}
                                    className={`${styles.roundCard} ${round.result === "p1" ? styles.roundP1 :
                                        round.result === "p2" ? styles.roundP2 :
                                            styles.roundDraw
                                        }`}
                                >
                                    <span className={styles.roundNum}>Round {round.round}</span>
                                    <div className={styles.roundMoves}>
                                        <div className={`${styles.moveBlock} ${round.result === "p1" ? styles.moveWin : ""}`}>
                                            <span className={styles.moveEmoji}>{round.p1Move}</span>
                                            <span className={styles.moveText}>{moveLabel[round.p1Move]}</span>
                                        </div>
                                        <span className={styles.roundVs}>vs</span>
                                        <div className={`${styles.moveBlock} ${round.result === "p2" ? styles.moveWin : ""}`}>
                                            <span className={styles.moveEmoji}>{round.p2Move}</span>
                                            <span className={styles.moveText}>{moveLabel[round.p2Move]}</span>
                                        </div>
                                    </div>
                                    <span className={styles.roundResult}>
                                        {round.result === "draw" ? "Draw" :
                                            round.result === "p1" ? `${player1.name} wins` :
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
                                        data-result={round.result === "p1" ? "win" : round.result === "p2" ? "loss" : "draw"}
                                    />
                                    {i < rounds.length - 1 && (
                                        <div className={styles.timelineLine} />
                                    )}
                                    <div className={styles.timelineContent}>
                                        <strong>Round {round.round}</strong>
                                        <span>
                                            {round.p1Move} {moveLabel[round.p1Move]} vs {round.p2Move} {moveLabel[round.p2Move]}
                                            {" · "}
                                            {round.result === "draw" ? "Draw" :
                                                round.result === "p1" ? `${player1.name} takes it` :
                                                    `${player2.name} takes it`}
                                        </span>
                                        <span className={styles.timelineScore}>
                                            Score: {rounds.slice(0, i + 1).filter(r => r.result === "p1").length}
                                            {" — "}
                                            {rounds.slice(0, i + 1).filter(r => r.result === "p2").length}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            <div className={styles.timelineItem}>
                                <div className={styles.timelineDot} data-result="final" />
                                <div className={styles.timelineContent}>
                                    <strong>Match Over</strong>
                                    <span>🏆 {game.winner} wins {player1.wins}–{player2.wins}</span>
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