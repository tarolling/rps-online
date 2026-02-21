"use client";

import { get, getDatabase, onValue, ref, update } from 'firebase/database';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Choice, GameState } from '@/lib/common';
import { Game, resolveRound } from '@/lib/matchmaking';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import styles from '@/styles/game.module.css';
import config from "@/config/settings.json";
import { Tournament } from '@/types/tournament';

// ── Constants ─────────────────────────────────────────────────────────────────

const CHOICE_EMOJI: Record<string, string> = {
    [Choice.Rock]: '✊',
    [Choice.Paper]: '✋',
    [Choice.Scissors]: '✌️',
};

const PLAYABLE_CHOICES = [Choice.Rock, Choice.Paper, Choice.Scissors];

// ── Component ─────────────────────────────────────────────────────────────────

const GamePage = () => {
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

    const playerID = user?.uid;
    const isPlayer1 = game?.player1.id === playerID;
    const playerData = isPlayer1 ? game?.player1 : game?.player2;
    const opponentData = isPlayer1 ? game?.player2 : game?.player1;
    const opponentKey = isPlayer1 ? 'player2' : 'player1';

    // Server-anchored round timer — auto-submits when it hits zero
    useEffect(() => {
        if (game?.state !== GameState.InProgress || !game.roundStartTimestamp || choice) return;

        const tick = () => {
            const elapsed = Math.floor((Date.now() - game.roundStartTimestamp) / 1000);
            const remaining = Math.max(0, config.roundTimeout - elapsed);
            setTimeLeft(remaining);
            if (remaining === 0) makeChoice(null);
        };

        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [game?.roundStartTimestamp, game?.state, choice]);

    // Subscribe to game state
    useEffect(() => {
        if (!gameId || !playerID) return;

        const gameRef = ref(db, `games/${gameId}`);
        const unsubscribe = onValue(gameRef, (snapshot) => {
            const data: Game = snapshot.val();
            setLoading(false);
            if (!data) return;

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
                setTimeout(() => resolveRound(gameId, playerID), 1000);
            }
        });

        return () => unsubscribe();
    }, [gameId, playerID]);

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

    const isFinished = game.state === GameState.Finished;
    const playerWon = game.winner === playerID;

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
                            score={opponentData?.score ?? 0}
                            choice={roundOver ? game[opponentKey].choice : null}
                            reveal={roundOver}
                            hasChosen={!!game[opponentKey].choice}
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

                    {/* Result */}
                    {isFinished && (
                        <div className={styles.result}>
                            <p className={`${styles.resultLabel} ${playerWon ? styles.victory : styles.defeat}`}>
                                {playerWon ? 'Victory!' : 'Defeat'}
                            </p>
                            <p className={styles.finalScore}>
                                {playerData?.score} — {opponentData?.score}
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
    score: number;
    choice: Choice | null;
    reveal?: boolean;
    hasChosen?: boolean;
};

function PlayerPanel({ label, name, score, choice, reveal = true, hasChosen = false }: PlayerPanelProps) {
    return (
        <div className={styles.playerPanel}>
            <span className={styles.playerLabel}>{label}</span>
            <span className={styles.playerName}>{name}</span>
            <span className={styles.playerScore}>{score}</span>
            <div className={`${styles.choiceDisplay} ${(choice && reveal) || hasChosen ? styles.choiceVisible : ''}`}>
                {choice && reveal ? CHOICE_EMOJI[choice] : hasChosen ? '✔️' : ''}
            </div>
        </div>
    );
}

export default GamePage;