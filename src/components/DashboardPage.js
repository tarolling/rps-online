import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../Auth';
import '../styles/DashboardPage.css';
import Header from './Header';

function DashboardPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [gameStats, setGameStats] = useState({
        totalGames: 0,
        winRate: "N/A",
        currentStreak: 0,
        bestStreak: 0
    });
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
            if (data["error"]) return;

            setGameStats((prevState) => ({
                ...prevState,
                totalGames: data.totalGames,
                winRate: data.winRate,
                currentStreak: data.currentStreak,
                bestStreak: data.bestStreak
            }));
        };

        fetchStats();
    }, []);

    // TODO: populate with real data
    const recentMatches = [
        { opponent: "Player123", result: "Win", choice: "Rock", opponentChoice: "Scissors", date: "2024-03-21" },
        { opponent: "GameMaster", result: "Loss", choice: "Paper", opponentChoice: "Scissors", date: "2024-03-20" },
        { opponent: "RPSKing", result: "Win", choice: "Scissors", opponentChoice: "Paper", date: "2024-03-19" },
    ];

    const handleNavigation = (path) => {
        navigate(path);
    };

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
                    <button className='play-button' onClick={() => handleNavigation('/play')}>
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
                                    <span className="match-opponent">{match.opponent}</span>
                                    <span className="match-result">{match.result}</span>
                                    <div className="match-details">
                                        <span>{match.choice} vs {match.opponentChoice}</span>
                                        <span className="match-date">{match.date}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

const LoadingState = () => (
    <div className="dashboard">
        <Header />
        <div className="dashboard-container">
            <div className="loading-spinner">Loading...</div>
        </div>
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
    </div>
);

export default DashboardPage;
