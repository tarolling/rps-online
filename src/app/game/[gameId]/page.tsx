"use client";

import { get, getDatabase, onValue, ref, update } from 'firebase/database';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Choice, GameState } from '@/util/common';
import { resolveRound } from '@/util/matchmaking';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import styles from '@/styles/game.module.css';

// ── Types ─────────────────────────────────────────────────────────────────────

type PlayerState = {
    id: string;
    username: string;
    score: number;
    choice: Choice | null;
};

type Game = {
    state: GameState;
    player1: PlayerState;
    player2: PlayerState;
    currentRound: number;
    winner?: string;
    tournamentId?: string;
    matchId?: string;
};

type TournamentInfo = {
    name: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const ROUND_TIME = 30;

const CHOICE_EMOJI: Record<string, string> = {
    [Choice.Rock]: '✊',
    [Choice.Paper]: '✋',
    [Choice.Scissors]: '✌️',
};

const PLAYABLE_CHOICES = [Choice.Rock, Choice.Paper, Choice.Scissors];

// ── Component ─────────────────────────────────────────────────────────────────

const GamePage = () => {
    const { gameID } = useParams<{ gameID: string }>();
    const { user } = useAuth();
    const router = useRouter();
    const db = getDatabase();

    const [game, setGame] = useState<Game | null>(null);
    const [tournamentInfo, setTournamentInfo] = useState<TournamentInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [choice, setChoice] = useState<Choice | null>(null);
    const [roundOver, setRoundOver] = useState(false);
    const [timeLeft, setTimeLeft] = useState(ROUND_TIME);

    const playerID = user?.uid;
    const isPlayer1 = game?.player1.id === playerID;
    const playerData = isPlayer1 ? game?.player1 : game?.player2;
    const opponentData = isPlayer1 ? game?.player2 : game?.player1;
    const opponentKey = isPlayer1 ? 'player2' : 'player1';

    // Subscribe to game state
    useEffect(() => {
        if (!gameID || !playerID) return;

        const gameRef = ref(db, `games/${gameID}`);
        const unsubscribe = onValue(gameRef, (snapshot) => {
            const data: Game = snapshot.val();
            if (!data) return;

            setGame((prev) => {
                // Reset per-round state when the round advances
                if (data.currentRound !== prev?.currentRound) {
                    setChoice(null);
                    setTimeLeft(ROUND_TIME);
                    setRoundOver(false);
                }
                return data;
            });
            setLoading(false);

            // Both players have chosen — resolve the round
            if (
                data.player1.choice &&
                data.player2.choice &&
                data.state === GameState.InProgress
            ) {
                setRoundOver(true);
                setTimeout(() => resolveRound(gameID, playerID), 1000);
            }
        });

        return () => unsubscribe();
    }, [gameID, playerID]);

    // Countdown timer — auto-submits None when it hits zero
    useEffect(() => {
        if (game?.state !== GameState.InProgress || choice || timeLeft <= 0) return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    makeChoice(null);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [game?.state, choice]);

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
            await update(ref(db, `games/${gameID}`), {
                [`${playerKey}/choice`]: selected,
            });
        } catch (err) {
            console.error('Error making choice:', err);
            setChoice(null);
        }
    }, [choice, game?.state, isPlayer1, gameID]);

    // ── Render ──────────────────────────────────────────────────────────────

    if (loading) return (
        <div className="app">
            <Header />
            <main className={styles.main}>
                <div className={styles.gameContainer}>
                    <p className={styles.loading}>Loading game…</p>
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