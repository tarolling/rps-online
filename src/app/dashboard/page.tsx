"use client";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import formatRelativeTime from "@/util/time";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function DashboardPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [gameStats, setGameStats] = useState({
        totalGames: 0,
        winRate: "N/A",
        currentStreak: 0,
        bestStreak: 0
    });
    const [recentMatches, setRecentMatches] = useState([]);
    const [playerData, setPlayerData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchStats = async () => {
            const stats = await fetch('/api/fetchDashboardStats', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    playerID: user.uid
                }),
            });

            const data = await stats.json();
            if (data?.error) return;

            setGameStats((prevState) => ({
                ...prevState,
                totalGames: data.totalGames,
                winRate: `${data.winRate.toFixed(1)}%`,
                currentStreak: data.currentStreak,
                bestStreak: data.bestStreak
            }));

            const recentGames = await fetch('/api/fetchRecentGames', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    playerID: user.uid
                }),
            });

            const games = await recentGames.json();
            if (games?.error) return;

            setRecentMatches(games);
        };

        fetchStats();
    }, []);

    useEffect(() => {
        if (!user) return;

        const fetchPlayer = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch('/api/fetchPlayer', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ uid: user.uid })
                });

                if (!response.ok) {
                    throw new Error("Unable to update player in database.");
                }

                const data = await response.json();
                setPlayerData(data);
            } catch (err) {
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
        <div className='dashboard'>
            <Header />
            <div className='dashboard-container'>
                <section className='welcome-section'>
                    <h1>Welcome back, {playerData?.username || 'Player'}!</h1>
                    <button className='play-button' onClick={() => router.push('/play')}>
                        Quick Play
                    </button>
                </section>
                <div className="dashboard-grid">
                    <section className="stats-card">
                        <h2>Your Statistics</h2>
                        <div className="stats-grid">
                            <div className="stat-item">
                                <span className="stat-value">{gameStats.totalGames}</span>
                                <span className="stat-label">Games Played</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-value">{gameStats.winRate}</span>
                                <span className="stat-label">Win Rate</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-value">{gameStats.currentStreak}</span>
                                <span className="stat-label">Current Streak</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-value">{gameStats.bestStreak}</span>
                                <span className="stat-label">Best Streak</span>
                            </div>
                        </div>
                    </section>

                    <section className="recent-matches-card">
                        <h2>Recent Matches</h2>
                        <div className="matches-list">
                            {recentMatches.map((match, index) => (
                                <div key={index} className={`match-item ${match.result.toLowerCase()}`}>
                                    <span
                                        onClick={() => router.push(`/profile/${match.opponentID}`)}
                                        className="match-opponent">{match.opponentUsername}
                                    </span>
                                    <span className="match-result">{match.result}</span>
                                    <div className="match-details">
                                        <span>{match.playerScore} - {match.opponentScore}</span>
                                        <span className="match-date">{formatRelativeTime(match.date)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
            <Footer />
        </div>
    );
}

const LoadingState = () => (
    <div className="dashboard">
        <Header />
        <div className="dashboard-container">
            <div className="loading-spinner">Loading...</div>
        </div>
        <Footer />
    </div>
);

const ErrorState = ({ error, onRetry }) => (
    <div className="dashboard">
        <Header />
        <div className="dashboard-container">
            <div className="error-card">
                <p>Error: {error}</p>
                <button onClick={onRetry}>Retry</button>
            </div>
        </div>
        <Footer />
    </div>
);

export default DashboardPage;