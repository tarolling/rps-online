"use client";

import { get, getDatabase, onValue, ref, remove, set, update } from 'firebase/database';
import { onDisconnect } from 'firebase/database';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { DISCONNECT_TIMEOUT, WAITING_TIMEOUT } from '@/lib/common';
import { resolveRound, awardWinByDisconnect } from '@/lib/matchmaking';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import styles from '@/styles/game.module.css';
import config from "@/config/settings.json";
import RankBadge from '@/components/RankBadge';
import Avatar from '@/components/Avatar';
import { getAvatarUrl } from '@/lib/avatar';
import { postJSON } from '@/lib/api';
import { Choice, Game, GameState, RoundData, Tournament, UserClub } from '@/types';

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
    const [playerAvatarUrl, setPlayerAvatarUrl] = useState<string | null>(null);
    const [opponentAvatarUrl, setOpponentAvatarUrl] = useState<string | null>(null);
    const [clubTags, setClubTags] = useState<Record<string, string | null>>({});

    const playerId = user?.uid;
    const isPlayer1 = game?.player1.id === playerId;
    const playerData = isPlayer1 ? game?.player1 : game?.player2;
    const opponentData = isPlayer1 ? game?.player2 : game?.player1;
    const opponentKey = isPlayer1 ? 'player2' : 'player1';

    const botRequestInFlight = useRef<Set<number>>(new Set());

    // Fetch avatars once we know both player IDs
    useEffect(() => {
        if (!playerId || !game) return;
        const opponentId = isPlayer1 ? game.player2.id : game.player1.id;
        getAvatarUrl(playerId).then(setPlayerAvatarUrl);
        getAvatarUrl(opponentId).then(setOpponentAvatarUrl);

        // fetch their club tags
        if (!clubTags[game.player1.id] && !clubTags[game.player2.id]) {
            Promise.all([
                postJSON<UserClub>('/api/clubs', { methodType: 'user', uid: game.player1.id }).catch(() => null),
                postJSON<UserClub>('/api/clubs', { methodType: 'user', uid: game.player2.id }).catch(() => null),
            ]).then(([p1Club, p2Club]) => {
                setClubTags({
                    [game.player1.id]: p1Club?.tag ?? null,
                    [game.player2.id]: p2Club?.tag ?? null,
                });
            });
        }
    }, [playerId, game?.player1.id, game?.player2.id]);

    // Server-anchored round timer — auto-submits when it hits zero
    useEffect(() => {
        if (game?.state !== GameState.InProgress || !game.roundStartTimestamp) return;
        const botIsPlayer1 = game.player1.id.startsWith('bot_');
        const resolverPlayerId = game.player1.id;
        const iAmResolver = isPlayer1 || botIsPlayer1;

        const tick = () => {
            const elapsed = Math.floor((Date.now() - game.roundStartTimestamp!) / 1000);
            const remaining = Math.max(0, config.roundTimeout - elapsed);
            setTimeLeft(remaining);
            if (remaining === 0 && iAmResolver) resolveRound(gameId, resolverPlayerId);
        };

        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [game?.roundStartTimestamp, game?.state, game?.player1.id]);

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
                    botRequestInFlight.current.clear();
                }
                return data;
            });

            // check for bot game
            const isABotGame = data.player1.id.startsWith('bot_') || data.player2.id.startsWith('bot_');
            const botId = data.player1.id.startsWith('bot_') ? data.player1.id : data.player2.id;
            const botIsPlayer1 = data.player1.id.startsWith('bot_');
            // Always use player1's ID for resolveRound, whether that's us or the bot
            const resolverPlayerId = data.player1.id;
            const iAmResolver = playerId === resolverPlayerId || botIsPlayer1;

            if (isABotGame && data.state === GameState.InProgress) {
                const botKey = botIsPlayer1 ? 'player1' : 'player2';
                const currentRound = data.currentRound;
                if (!data[botKey].submitted && !botRequestInFlight.current.has(currentRound)) {
                    botRequestInFlight.current.add(currentRound);
                    fetch('/api/botPlay', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ gameId, botId }),
                    });
                }
            }

            if (
                data.player1.submitted &&
                data.player2.submitted &&
                data.state === GameState.InProgress
            ) {
                setRoundOver(true);
                if (iAmResolver) setTimeout(() => resolveRound(gameId, resolverPlayerId), 1000);
            }
        });

        return () => unsubscribe();
    }, [gameId, playerId]);

    // Set presence once on mount, never clean it up early
    useEffect(() => {
        if (!gameId || !playerId) return;
        const presenceRef = ref(db, `games/${gameId}/presence/${playerId}`);
        set(presenceRef, true).then(() => {
            onDisconnect(presenceRef).remove();
        });
        return () => { remove(presenceRef) }; // only runs on true unmount
    }, [gameId, playerId]);

    // Separate effect just for starting the game — re-runs on state change is fine here
    useEffect(() => {
        if (!gameId || !playerId) return;

        const presenceRootRef = ref(db, `games/${gameId}/presence`);
        const unsubPresence = onValue(presenceRootRef, async (snapshot) => {
            const presence = snapshot.val() ?? {};

            // get fresh game state from firebase
            const gameSnap = await get(ref(db, `games/${gameId}`));
            const currentGame = gameSnap.val();

            if (!currentGame || currentGame.state !== GameState.Waiting) return;

            if (
                currentGame.player1.id &&
                currentGame.player2.id &&
                presence[currentGame.player1.id] &&
                presence[currentGame.player2.id]
            ) {
                const iAmPlayer1 = playerId === currentGame.player1.id;
                const player1IsBot = currentGame.player1.id.startsWith('bot_');
                if (iAmPlayer1 || player1IsBot) {
                    await update(ref(db, `games/${gameId}`), {
                        state: GameState.InProgress,
                        roundStartTimestamp: Date.now(),
                    });
                }
            }
        });

        return () => unsubPresence();
    }, [gameId, playerId]);


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
                    <p className={styles.loading}>Waiting for opponent to connect...</p>
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
                            onClick={() => router.push(game.tournamentId ? `/tournaments/${game.tournamentId}` : '/play')}
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
                            clubTag={playerData ? clubTags[playerData.id] : null}
                            rating={playerData?.rating ?? 0}
                            score={playerData?.score ?? 0}
                            choice={choice}
                            avatarUrl={playerAvatarUrl}
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
                                onClick={() => router.push(game.tournamentId ? `/tournaments/${game.tournamentId}` : '/play')}
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
    clubTag?: string | null;
    avatarUrl?: string | null;
    reveal?: boolean;
    hasChosen?: boolean;
    disconnected?: boolean;
};

function PlayerPanel({ label, name, rating, score, choice, avatarUrl, clubTag, reveal = true, hasChosen = false, disconnected = false }: PlayerPanelProps) {
    return (
        <div className={styles.playerPanel}>
            <span className={styles.playerLabel}>{label}</span>
            <Avatar src={avatarUrl} username={name} size="md" />
            <span className={styles.playerName}>
                {clubTag && <span className={styles.playerClubTag}>[{clubTag}]</span>} {name} {disconnected && <span className={styles.disconnectedBadge}>● Disconnected</span>}
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