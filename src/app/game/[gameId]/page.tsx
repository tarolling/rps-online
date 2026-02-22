"use client";

import { get, getDatabase, onValue, ref, remove, set, update } from 'firebase/database';
import { onDisconnect } from 'firebase/database';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Choice, DISCONNECT_TIMEOUT, GameState, WAITING_TIMEOUT } from '@/lib/common';
import { RoundData, Game, resolveRound, awardWinByDisconnect } from '@/lib/matchmaking';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import styles from '@/styles/game.module.css';
import config from "@/config/settings.json";
import { Tournament } from '@/types/tournament';
import RankBadge from '@/components/RankBadge';

// ── Constants ─────────────────────────────────────────────────────────────────

const CHOICE_EMOJI: Record<string, string> = {
    [Choice.Rock]: '✊',
    [Choice.Paper]: '✋',
    [Choice.Scissors]: '✌️',
};

const PLAYABLE_CHOICES = [Choice.Rock, Choice.Paper, Choice.Scissors];

// ── Component ─────────────────────────────────────────────────────────────────

function GamePage() {
    const { gameId } = useParams<{ gameId: string }>();
    const { user } = useAuth();
    const router = useRouter();
    const db = getDatabase();

    const [game, setGame] = useState<Game | null>(null);
    const [tournamentInfo, setTournamentInfo] = useState<Tournament | null>(null);
    const [loading, setLoading] = useState(true);
    const [choice, setChoice] = useState<Choice | null>(null);
    const [roundOver, setRoundOver] = useState(false);
    const [timeLeft, setTimeLeft] = useState(config.roundTimeout);
    const [opponentConnected, setOpponentConnected] = useState(true);

    const playerId = user?.uid;
    const isPlayer1 = game?.player1.id === playerId;
    const playerData = isPlayer1 ? game?.player1 : game?.player2;
    const opponentData = isPlayer1 ? game?.player2 : game?.player1;
    const opponentKey = isPlayer1 ? 'player2' : 'player1';

    // Server-anchored round timer — auto-submits when it hits zero
    useEffect(() => {
        if (game?.state !== GameState.InProgress || !game.roundStartTimestamp) return;

        const tick = () => {
            const elapsed = Math.floor((Date.now() - game.roundStartTimestamp!) / 1000);
            const remaining = Math.max(0, config.roundTimeout - elapsed);
            setTimeLeft(remaining);
            if (remaining === 0) resolveRound(gameId, playerId!);
        };

        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [game?.roundStartTimestamp, game?.state]);

    // Subscribe to game state
    useEffect(() => {
        if (!gameId || !playerId) return;

        const gameRef = ref(db, `games/${gameId}`);
        const unsubscribe = onValue(gameRef, (snapshot) => {
            const data: Game = snapshot.val();
            setLoading(false);
            if (!data) return;
            if (!data.player1 || !data.player2) return;
            if (data.state === GameState.Cancelled) {
                setGame(data);
                remove(ref(db, `games/${gameId}`));
                return;
            }

            setGame((prev) => {
                if (data.currentRound !== prev?.currentRound) {
                    setChoice(null);
                    setTimeLeft(config.roundTimeout);
                    setRoundOver(false);
                }
                return data;
            });

            // Both players have submitted (choice may be null if they timed out)
            if (
                data.player1.submitted &&
                data.player2.submitted &&
                data.state === GameState.InProgress
            ) {
                setRoundOver(true);
                setTimeout(() => resolveRound(gameId, playerId), 1000);
            }
        });

        // Register disconnect handler
        const presenceRef = ref(db, `games/${gameId}/presence/${playerId}`);
        set(presenceRef, true).then(() => {
            onDisconnect(presenceRef).remove();
        });

        return () => unsubscribe();
    }, [gameId, playerId]);

    // Set presence + start game when both players arrive
    useEffect(() => {
        if (!gameId || !playerId || !game) return;

        const presenceRef = ref(db, `games/${gameId}/presence/${playerId}`);
        set(presenceRef, true).then(() => {
            onDisconnect(presenceRef).remove();
        });

        const presenceRootRef = ref(db, `games/${gameId}/presence`);
        const unsubPresence = onValue(presenceRootRef, async (snapshot) => {
            const presence = snapshot.val() ?? {};
            if (
                game.state === GameState.Waiting &&
                game.player1.id &&
                game.player2.id &&
                presence[game.player1.id] &&
                presence[game.player2.id] &&
                playerId === game.player1.id
            ) {
                await update(ref(db, `games/${gameId}`), {
                    state: GameState.InProgress,
                    roundStartTimestamp: Date.now(),
                });
            }
        });

        return () => {
            unsubPresence();
            remove(presenceRef);
        };
    }, [gameId, playerId, game?.state]);


    // watch opponent's presence for disconnects
    useEffect(() => {
        if (!gameId || !playerId || !game) return;
        if (game.state !== GameState.InProgress && game.state !== GameState.Waiting) return;

        const opponentId = isPlayer1 ? game.player2.id : game.player1.id;
        const opponentPresenceRef = ref(db, `games/${gameId}/presence/${opponentId}`);
        let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

        const unsubscribe = onValue(opponentPresenceRef, (snapshot) => {
            const connected = snapshot.exists();
            setOpponentConnected(connected);
            if (!connected) {
                const timeout = game.state === GameState.Waiting ? WAITING_TIMEOUT * 1000 : DISCONNECT_TIMEOUT * 1000;
                disconnectTimer = setTimeout(async () => {
                    const myPresence = await get(ref(db, `games/${gameId}/presence/${playerId}`));
                    if (!myPresence.exists()) {
                        // both disconnected — cancel
                        await update(ref(db, `games/${gameId}`), { state: GameState.Cancelled });
                    } else {
                        awardWinByDisconnect(gameId, playerId);
                    }
                }, timeout);
            } else {
                // we reconnected in time - cancel the timer
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

    // Fetch tournament info if this is a tournament game
    useEffect(() => {
        if (!game?.tournamentId) return;

        get(ref(db, `tournaments/${game.tournamentId}`)).then((snapshot) => {
            if (snapshot.exists()) setTournamentInfo(snapshot.val());
        });
    }, [game?.tournamentId]);

    const makeChoice = useCallback(async (selected: Choice | null) => {
        if (choice || game?.state !== GameState.InProgress) return;
        setChoice(selected);

        const playerKey = isPlayer1 ? 'player1' : 'player2';
        try {
            await update(ref(db, `games/${gameId}`), {
                [`${playerKey}/choice`]: selected,
                [`${playerKey}/submitted`]: true,
            });
        } catch (err) {
            console.error('Error making choice:', err);
            setChoice(null);
        }
    }, [choice, game?.state, isPlayer1, gameId]);

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
                        <button className={styles.playAgainButton} onClick={() => router.push('/')}>
                            Return Home
                        </button>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );

    if (game.state === GameState.Waiting) return (
        <div className="app">
            <Header />
            <main className={styles.main}>
                <div className={styles.gameContainer}>
                    <p className={styles.loading}>Waiting for opponent to connect…</p>
                </div>
            </main>
            <Footer />
        </div>
    );

    if (game.state === GameState.Cancelled) return (
        <div className="app">
            <Header />
            <main className={styles.main}>
                <div className={styles.gameContainer}>
                    <div className={styles.result}>
                        <p className={styles.resultLabel}>Game Cancelled</p>
                        <p className={styles.hint}>Both players disconnected.</p>
                        <button
                            className={styles.playAgainButton}
                            onClick={() => router.push(game.tournamentId ? `/tournament/${game.tournamentId}` : '/play')}
                        >
                            {game.tournamentId ? 'Return to Tournament' : 'Play Again'}
                        </button>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );

    const isFinished = game.state === GameState.Finished;
    const playerWon = game.winner === playerId;

    return (
        <div className="app">
            <Header />
            <main className={styles.main}>
                <div className={styles.gameContainer}>

                    {/* Tournament badge */}
                    {tournamentInfo && (
                        <div className={styles.tournamentBadge}>
                            <span>{tournamentInfo.name}</span>
                            <span className={styles.tournamentMatch}>Match {game.matchId}</span>
                        </div>
                    )}

                    {/* Scoreboard */}
                    <div className={styles.scoreboard}>
                        <PlayerPanel
                            label="You"
                            name={playerData?.username ?? 'Player'}
                            rating={playerData?.rating ?? 0}
                            score={playerData?.score ?? 0}
                            choice={choice}
                        />

                        <div className={styles.vsBlock}>
                            <span className={styles.roundLabel}>Round</span>
                            <span className={styles.roundNumber}>{game.currentRound}</span>
                            <div className={`${styles.timer} ${timeLeft <= 10 ? styles.timerWarning : ''}`}>
                                {timeLeft}s
                            </div>
                        </div>

                        <PlayerPanel
                            label="Opponent"
                            name={opponentData?.username ?? 'Opponent'}
                            rating={opponentData?.rating ?? 0}
                            score={opponentData?.score ?? 0}
                            choice={roundOver ? game[opponentKey].choice : null}
                            reveal={roundOver}
                            hasChosen={!!game[opponentKey].choice}
                            disconnected={!opponentConnected}
                        />
                    </div>

                    {/* Choices */}
                    {!isFinished && (
                        <div className={styles.choices}>
                            {PLAYABLE_CHOICES.map((c) => (
                                <button
                                    key={c}
                                    onClick={() => makeChoice(c)}
                                    disabled={!!choice}
                                    className={`${styles.choiceButton} ${choice === c ? styles.selected : ''}`}
                                >
                                    <span className={styles.choiceEmoji}>{CHOICE_EMOJI[c]}</span>
                                    <span className={styles.choiceLabel}>{c}</span>
                                </button>
                            ))}
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
                                {playerWon ? 'Victory!' : 'Defeat'}
                            </p>
                            <p className={styles.finalScore}>
                                {playerData?.score} - {opponentData?.score}
                            </p>
                            <button
                                className={styles.playAgainButton}
                                onClick={() => router.push(game.tournamentId ? `/tournament/${game.tournamentId}` : '/play')}
                            >
                                {game.tournamentId ? 'Return to Tournament' : 'Play Again'}
                            </button>
                        </div>
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
};

// ── Sub-components ────────────────────────────────────────────────────────────

type PlayerPanelProps = {
    label: string;
    name: string;
    rating: number;
    score: number;
    choice: Choice | null;
    reveal?: boolean;
    hasChosen?: boolean;
    disconnected?: boolean;
};

function PlayerPanel({ label, name, rating, score, choice, reveal = true, hasChosen = false, disconnected = false }: PlayerPanelProps) {
    return (
        <div className={styles.playerPanel}>
            <span className={styles.playerLabel}>{label}</span>
            <span className={styles.playerName}>
                {name} {disconnected && <span className={styles.disconnectedBadge}>● Disconnected</span>}
            </span>
            <RankBadge rating={rating} variant='compact' />
            <span className={styles.playerScore}>{score}</span>
            <div className={`${styles.choiceDisplay} ${(choice && reveal) || hasChosen ? styles.choiceVisible : ''}`}>
                {choice && reveal ? CHOICE_EMOJI[choice] : hasChosen ? '✔️' : ''}
            </div>
        </div>
    );
}

function RoundHistory({ rounds, isPlayer1 }: { rounds: Record<number, RoundData>; isPlayer1: boolean }) {
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
                const myKey = isPlayer1 ? 'player1' : 'player2';
                const outcome = data.winner === myKey ? 'win' : data.winner === 'draw' ? 'draw' : 'loss';

                return (
                    <div key={round} className={`${styles.roundHistoryRow} ${styles[outcome]}`}>
                        <span>{myChoice === null ? '⏱️' : CHOICE_EMOJI[myChoice]}</span>
                        <span className={styles.roundHistoryLabel}>R{round}</span>
                        <span>{theirChoice === null ? '⏱️' : CHOICE_EMOJI[theirChoice]}</span>
                    </div>
                );
            })}
        </div>
    );
}

export default GamePage;