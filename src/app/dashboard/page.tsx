"use client";

import { useEffect, useState } from 'react';
import styles from './DashboardPage.module.css';
import { useAuth } from '@/context/AuthContext';
import { getJSON, postJSON } from '@/lib/api';
import Link from 'next/link';
import formatRelativeTime from '@/lib/time';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Match, ProfileData } from '@/types/common';
import config from '@/config/settings.json';
import RankBadge from '@/components/RankBadge';

export default function DashboardPage() {
    const { user } = useAuth();
    const [gameStats, setGameStats] = useState({
        rating: config.defaultRating,
        totalGames: 0,
        winRate: "N/A",
        currentStreak: 0,
        bestStreak: 0
    });
    const [recentMatches, setRecentMatches] = useState<Match[]>([]);
    const [playerData, setPlayerData] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchStats = async () => {
            const data = await postJSON<{ rating: number, totalGames: number, winRate: number, currentStreak: number, bestStreak: number }>('/api/fetchDashboardStats', {
                playerId: user?.uid
            });

            setGameStats((prevState) => ({
                ...prevState,
                rating: data.rating,
                totalGames: data.totalGames,
                winRate: `${data.winRate.toFixed(1)}%`,
                currentStreak: data.currentStreak,
                bestStreak: data.bestStreak
            }));

            const recentGames = await getJSON('/api/fetchRecentGames', {
                playerId: user?.uid
            });

            setRecentMatches(recentGames);
        };

        fetchStats();
    }, []);

    useEffect(() => {
        if (!user) return;

        const fetchPlayer = async () => {
            try {
                setLoading(true);
                setError(null);

                const data = await postJSON<ProfileData>('/api/fetchPlayer', { uid: user.uid });
                setPlayerData(data);
            } catch (err: any) {
                console.error('Error fetching player:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchPlayer();
    }, [user]);

    if (loading) return <LoadingState />;
    if (error) return <ErrorState error={error} onRetry={() => window.location.reload()} />;

    return (
        <div className={styles.dashboard}>
            <Header />
            <div className={styles.dashboardContainer}>
                <section className={styles.welcomeSection}>
                    <h1>Welcome back, {playerData?.username || 'Player'}!</h1>
                    <Link className={styles.playButton} href='/play'>
                        Quick Play
                    </Link>
                </section>
                <div className={styles.dashboardGrid}>
                    <section className={styles.statsCard}>
                        <h2>Your Statistics</h2>
                        <div className={styles.statsGrid}>
                            <div className={styles.statItem}>
                                <span className={styles.statValue}><RankBadge rating={gameStats.rating} /></span>
                                <span className={styles.statLabel}>Rank</span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statValue}>{gameStats.rating}</span>
                                <span className={styles.statLabel}>Skill Rating</span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statValue}>{gameStats.totalGames}</span>
                                <span className={styles.statLabel}>Games Played</span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statValue}>{gameStats.winRate}</span>
                                <span className={styles.statLabel}>Win Rate</span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statValue}>{gameStats.currentStreak}</span>
                                <span className={styles.statLabel}>Current Streak</span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statValue}>{gameStats.bestStreak}</span>
                                <span className={styles.statLabel}>Best Streak</span>
                            </div>
                        </div>
                    </section>

                    <section className={styles.recentMatchesCard}>
                        <h2>Recent Matches</h2>
                        <div className={styles.matchesList}>
                            {recentMatches.map((match, index) => (
                                <div key={index} className={`${styles.matchItem} ${styles[match.result.toLowerCase()]}`}>
                                    <Link href={`/profile/${match.opponentID}`} className={styles.matchOpponent}>
                                        {match.opponentUsername}
                                    </Link>
                                    <span className={styles.matchResult}>{match.result}</span>
                                    <div className={styles.matchDetails}>
                                        <span>{match.playerScore} - {match.opponentScore}</span>
                                        <span className={styles.matchDate}>{formatRelativeTime(match.date)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div >
            <Footer />
        </div >
    );
}

const LoadingState = () => (
    <div className={styles.dashboard}>
        <Header />
        <div className={styles.dashboardContainer}>
            <div className={styles.loadingSpinner}>Loading...</div>
        </div>
        <Footer />
    </div>
);

const ErrorState = ({ error, onRetry }: { error: string, onRetry: any }) => (
    <div className={styles.dashboard}>
        <Header />
        <div className={styles.dashboardContainer}>
            <div className={styles.errorCard}>
                <p>Error: {error}</p>
                <button onClick={onRetry}>Retry</button>
            </div>
        </div>
        <Footer />
    </div>
);
