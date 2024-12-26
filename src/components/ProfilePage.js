import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAuth } from '../Auth';
import '../styles/ProfilePage.css';
import Header from './Header';

function ProfilePage() {
    const { userId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [gameStats, setGameStats] = useState({
        totalGames: 0,
        winRate: "N/A",
        currentStreak: 0,
        bestStreak: 0
    });
    const [recentMatches, setRecentMatches] = useState([]);

    const isOwnProfile = user?.uid === userId;

    useEffect(() => {
        fetchProfileData();
        fetchStats();
    }, [userId]);

    const fetchProfileData = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/fetchPlayer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ uid: userId })
            });

            if (!response.ok) {
                throw new Error("Unable to fetch profile data.");
            }

            const data = await response.json();
            setProfileData(data);
            setNewUsername(data.username);
        } catch (err) {
            console.error('Error fetching profile:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const stats = await fetch('/api/fetchDashboardStats', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ playerID: userId }),
            });

            const data = await stats.json();
            if (!data.error) {
                setGameStats({
                    totalGames: data.totalGames,
                    winRate: `${data.winRate.toFixed(1)}%`,
                    currentStreak: data.currentStreak,
                    bestStreak: data.bestStreak
                });
            }

            const recentGames = await fetch('/api/fetchRecentGames', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ playerID: userId }),
            });

            const games = await recentGames.json();
            if (!games.error) {
                setRecentMatches(games);
            }
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    };

    const handleUpdateUsername = async () => {
        try {
            const response = await fetch('/api/updateUsername', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    uid: userId,
                    newUsername
                })
            });

            if (!response.ok) {
                throw new Error("Failed to update username");
            }

            setProfileData(prev => ({ ...prev, username: newUsername }));
            setIsEditing(false);
        } catch (err) {
            console.error('Error updating username:', err);
            setError(err.message);
        }
    };

    const handleDeleteAccount = async () => {
        if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
            try {
                const response = await fetch('/api/deleteAccount', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ uid: userId })
                });

                if (!response.ok) {
                    throw new Error("Failed to delete account");
                }

                await user.delete();
                navigate('/login', { replace: true });
            } catch (err) {
                console.error('Error deleting account:', err);
                setError(err.message);
            }
        }
    };

    if (loading) return <LoadingState />;
    if (error) return <ErrorState error={error} onRetry={() => window.location.reload()} />;

    return (
        <div className="profile-page">
            <Header />
            <div className="profile-container">
                <section className="profile-header">
                    <div className="profile-info">
                        {isEditing ? (
                            <div className="username-edit">
                                <input
                                    type="text"
                                    value={newUsername}
                                    onChange={(e) => setNewUsername(e.target.value)}
                                    className="username-input"
                                />
                                <button onClick={handleUpdateUsername} className="save-button">
                                    Save
                                </button>
                                <button onClick={() => setIsEditing(false)} className="cancel-button">
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <h1>{profileData?.username || 'Player'}</h1>
                        )}
                        {isOwnProfile && (
                            <div className="profile-actions">
                                {!isEditing && (
                                    <button onClick={() => setIsEditing(true)} className="edit-button">
                                        Edit Username
                                    </button>
                                )}
                                <button onClick={handleDeleteAccount} className="delete-button">
                                    Delete Account
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                <div className="profile-grid">
                    <section className="stats-card">
                        <h2>Statistics</h2>
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
                                        <span>{match.playerScore} - {match.opponentScore}</span>
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
    <div className="profile-page">
        <Header />
        <div className="profile-container">
            <div className="loading-spinner">Loading...</div>
        </div>
    </div>
);

const ErrorState = ({ error, onRetry }) => (
    <div className="profile-page">
        <Header />
        <div className="profile-container">
            <div className="error-card">
                <p>Error: {error}</p>
                <button onClick={onRetry}>Retry</button>
            </div>
        </div>
    </div>
);

export default ProfilePage;