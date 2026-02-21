"use client";

import { getDatabase, onValue, ref, set } from 'firebase/database';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { startTournament, getCurrentMatch } from '@/lib/tournaments';
import type { Tournament, Match, Participant } from '@/types/tournament';
import { postJSON } from '@/lib/api';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import styles from './TournamentPage.module.css';

// ── Component ─────────────────────────────────────────────────────────────────

const TournamentPage = () => {
    const { tournamentID } = useParams<{ tournamentID: string }>();
    const { user } = useAuth();
    const db = getDatabase();

    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [userRegistered, setUserRegistered] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Subscribe to tournament data
    useEffect(() => {
        const tournamentRef = ref(db, `tournaments/${tournamentID}`);
        const unsubscribe = onValue(tournamentRef, (snapshot) => {
            const data: Tournament = snapshot.val();
            if (data) {
                setTournament(data);
                setUserRegistered(!!data.participants?.[user?.uid ?? '']);
            }
        });
        return () => unsubscribe();
    }, [tournamentID, user?.uid]);

    // Check admin claim from Firebase token
    useEffect(() => {
        if (!user) return;
        user.getIdTokenResult().then((token) => {
            setIsAdmin(!!token.claims.admin);
        });
    }, [user]);

    const handleStartTournament = async () => {
        if (!tournament || tournament.status !== 'registration') return;
        setError(null);
        try {
            await startTournament(tournamentID);
        } catch (err) {
            console.error('Error starting tournament:', err);
            setError('Failed to start tournament. Please try again.');
        }
    };

    const handleRegister = async () => {
        if (!tournament || !user) return;
        setError(null);

        const participantCount = Object.keys(tournament.participants ?? {}).length;
        if (participantCount >= tournament.playerCap) {
            setError('Tournament is full.');
            return;
        }

        try {
            const userData = await postJSON<{ username: string; rating: number }>(
                '/api/fetchPlayer',
                { uid: user.uid }
            );
            await set(ref(db, `tournaments/${tournamentID}/participants/${user.uid}`), {
                id: user.uid,
                username: userData.username,
                rating: userData.rating,
                registered: Date.now(),
            });
        } catch (err) {
            console.error('Error registering:', err);
            setError('Failed to register. Please try again.');
        }
    };

    if (!tournament) return (
        <div className="app">
            <Header />
            <main className={styles.main}>
                <p className={styles.loading}>Loading tournament…</p>
            </main>
            <Footer />
        </div>
    );

    const participants = Object.values(tournament.participants ?? {});
    const participantCount = participants.length;
    const isFull = participantCount >= tournament.playerCap;
    const nextMatch = getCurrentMatch(tournament, user?.uid ?? '');

    return (
        <div className="app">
            <Header />
            <main className={styles.main}>
                {/* Header */}
                <div className={styles.tournamentHeader}>
                    <Link href="/tournaments" className={styles.backLink}>← Back to Tournaments</Link>
                    <h1>{tournament.name}</h1>
                    {tournament.description && (
                        <p className={styles.description}>{tournament.description}</p>
                    )}
                </div>

                {error && <p className={styles.errorBanner}>{error}</p>}

                {/* Admin controls */}
                {isAdmin && tournament.status === 'registration' && (
                    <section className={styles.card}>
                        <h2>Admin Controls</h2>
                        <button
                            className={styles.startButton}
                            onClick={handleStartTournament}
                            disabled={participantCount < 2}
                        >
                            Start Tournament
                        </button>
                        {participantCount < 2 && (
                            <p className={styles.hint}>At least 2 players required to start.</p>
                        )}
                    </section>
                )}

                {/* Registration */}
                {tournament.status === 'registration' && (
                    <section className={styles.card}>
                        <div className={styles.registrationHeader}>
                            <h2>Registration {isFull ? 'Full' : 'Open'}</h2>
                            <span className={styles.playerCount}>{participantCount}/{tournament.playerCap} players</span>
                        </div>

                        {userRegistered ? (
                            <p className={styles.registeredMsg}>✓ You're registered!</p>
                        ) : (
                            <button
                                className={styles.registerButton}
                                onClick={handleRegister}
                                disabled={isFull}
                            >
                                {isFull ? 'Tournament Full' : 'Register'}
                            </button>
                        )}

                        {participants.length > 0 && (
                            <div className={styles.participantsList}>
                                <h3>Registered Players</h3>
                                <div className={styles.participantsGrid}>
                                    {participants
                                        .sort((a, b) => b.rating - a.rating)
                                        .map((p) => (
                                            <div key={p.id} className={styles.participantCard}>
                                                <span className={styles.participantName}>{p.username}</span>
                                                <span className={styles.participantRating}>{p.rating}</span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* In progress */}
                {tournament.status === 'in_progress' && (
                    <>
                        {userRegistered && nextMatch && (
                            <section className={styles.card}>
                                <h2>Your Next Match</h2>
                                <MatchCard
                                    match={nextMatch}
                                    gameID={tournament.matchGames?.[nextMatch.matchId]}
                                    userUID={user?.uid}
                                />
                            </section>
                        )}
                        {userRegistered && !nextMatch && (
                            <section className={styles.card}>
                                <p className={styles.hint}>You have no upcoming matches.</p>
                            </section>
                        )}
                        <section className={styles.card}>
                            <h2>Bracket</h2>
                            <Bracket bracket={tournament.bracket ?? []} />
                        </section>
                    </>
                )}

                {/* Completed */}
                {tournament.status === 'completed' && (
                    <section className={styles.card}>
                        <h2>Tournament Complete!</h2>
                        {tournament.winner && (
                            <div className={styles.winnerDisplay}>
                                <span className={styles.winnerCrown}>🏆</span>
                                <span className={styles.winnerName}>{tournament.winner.username}</span>
                            </div>
                        )}
                        <Bracket bracket={tournament.bracket ?? []} />
                    </section>
                )}
            </main>
            <Footer />
        </div>
    );
};

// ── Sub-components ────────────────────────────────────────────────────────────

function MatchCard({ match, gameID, userUID }: { match: Match; gameID?: string; userUID?: string }) {
    const isPlayer1 = match.player1?.id === userUID;
    return (
        <div className={styles.matchCard}>
            <div className={styles.matchPlayers}>
                <span className={isPlayer1 ? styles.you : ''}>
                    {match.player1?.username ?? 'TBD'}{isPlayer1 ? ' (You)' : ''}
                </span>
                <span className={styles.matchVs}>vs</span>
                <span className={!isPlayer1 ? styles.you : ''}>
                    {match.player2?.username ?? 'TBD'}{!isPlayer1 ? ' (You)' : ''}
                </span>
            </div>
            {gameID && (
                <Link href={`/game/${gameID}`} className={styles.playButton}>
                    Play Match
                </Link>
            )}
        </div>
    );
}

function Bracket({ bracket }: { bracket: Match[] }) {
    const rounds = bracket.reduce<Record<number, Match[]>>((acc, match) => {
        (acc[match.round] ??= []).push(match);
        return acc;
    }, {});

    return (
        <div className={styles.bracket}>
            {Object.entries(rounds).map(([round, matches]) => (
                <div key={round} className={styles.bracketRound}>
                    <div className={styles.roundHeader}>Round {round}</div>
                    <div className={styles.roundMatches}>
                        {matches.map((match) => (
                            <div key={match.matchId} className={`${styles.bracketMatch} ${styles[match.status]}`}>
                                <BracketPlayer
                                    participant={match.player1}
                                    isWinner={match.winner?.id === match.player1?.id}
                                    isBye={false}
                                />
                                <BracketPlayer
                                    participant={match.player2}
                                    isWinner={match.winner?.id === match.player2?.id}
                                    isBye={match.status === 'bye'}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

function BracketPlayer({ participant, isWinner, isBye }: {
    participant: Participant | null;
    isWinner: boolean;
    isBye: boolean;
}) {
    return (
        <div className={`${styles.bracketPlayer} ${isWinner ? styles.winner : ''}`}>
            <span className={styles.bracketSeed}>{isBye ? 'X' : (participant?.seed ?? '?')}</span>
            <span className={styles.bracketName}>{isBye ? 'BYE' : (participant?.username ?? 'TBD')}</span>
        </div>
    );
}

export default TournamentPage;