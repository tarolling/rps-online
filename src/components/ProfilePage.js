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
    const [clubStats, setClubStats] = useState({});
    const [recentMatches, setRecentMatches] = useState([]);

    const isOwnProfile = user?.uid === userId;

    useEffect(() => {
        fetchProfileData();
        fetchStats();
    }, [userId]);

    const handleNavigation = (path) => {
        navigate(path);
    };

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

            let data = await stats.json();
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

            data = await recentGames.json();
            if (!data.error) {
                setRecentMatches(data);
            }

            const userClub = await fetch('/api/clubs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ methodType: 'user', uid: user.uid })
            });
            data = await userClub.json();
            if (!data.error) {
                setClubStats(data.clubs);
            }
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    };

    const handleUpdateUsername = async () => {
        try {
            let response = await fetch('/api/checkUsername', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: newUsername })
            });

            if (!response.ok) {
                throw new Error("Unable to fetch usernames; try again later.");
            }

            const data = await response.json();
            if (data.usernameExists) {
                throw new Error("Username already exists!");
            }

            response = await fetch('/api/updateUsername', {
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
                await user.delete();

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
                            <div className="profile-username-edit">
                                <input
                                    type="text"
                                    value={newUsername}
                                    onChange={(e) => setNewUsername(e.target.value)}
                                    className="profile-username-input"
                                />
                                <button onClick={handleUpdateUsername} className="profile-save-button">
                                    Save
                                </button>
                                <button onClick={() => setIsEditing(false)} className="profile-cancel-button">
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <h1>{profileData?.username || 'Player'}</h1>
                        )}
                        {isOwnProfile && (
                            <div className="profile-actions">
                                {!isEditing && (
                                    <button onClick={() => setIsEditing(true)} className="profile-edit-button">
                                        Edit Username
                                    </button>
                                )}
                                <button onClick={handleDeleteAccount} className="profile-delete-button">
                                    Delete Account
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                <div className="profile-grid">
                    <section className="profile-stats-card">
                        <h2>Statistics</h2>
                        <div className="profile-stats-grid">
                            <div className="profile-stat-item">
                                <span className="profile-stat-value">{gameStats.totalGames}</span>
                                <span className="profile-stat-label">Games Played</span>
                            </div>
                            <div className="profile-stat-item">
                                <span className="profile-stat-value">{gameStats.winRate}</span>
                                <span className="profile-stat-label">Win Rate</span>
                            </div>
                            <div className="profile-stat-item">
                                <span className="profile-stat-value">{gameStats.currentStreak}</span>
                                <span className="profile-stat-label">Current Streak</span>
                            </div>
                            <div className="profile-stat-item">
                                <span className="profile-stat-value">{gameStats.bestStreak}</span>
                                <span className="profile-stat-label">Best Streak</span>
                            </div>
                        </div>
                    </section>

                    <section className="profile-recent-matches-card">
                        <h2>Recent Matches</h2>
                        <div className="profile-matches-list">
                            {recentMatches.map((match, index) => (
                                <div key={index} className={`profile-match-item ${match.result.toLowerCase()}`}>
                                    <span
                                        onClick={() => handleNavigation(`/profile/${match.opponentID}`)}
                                        className="profile-match-opponent">{match.opponentUsername}
                                    </span>
                                    <span className="profile-match-result">{match.result}</span>
                                    <div className="profile-match-details">
                                        <span>{match.playerScore} - {match.opponentScore}</span>
                                        <span className="profile-match-date">{match.date}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="profile-stats-card">
                        <h2>Club</h2>
                        <div className="profile-stats-grid">
                            <div className="profile-stat-item">
                                <span className="profile-stat-value">{clubStats?.name}</span>
                                <span className="profile-stat-label">Club Name</span>
                            </div>
                            <div className="profile-stat-item">
                                <span className="profile-stat-value">{clubStats?.tag}</span>
                                <span className="profile-stat-label">Club Tag</span>
                            </div>
                            <div className="profile-stat-item">
                                <span className="profile-stat-value">{clubStats?.memberRole}</span>
                                <span className="profile-stat-label">Role</span>
                            </div>
                            <div className="profile-stat-item">
                                <span className="profile-stat-value">{clubStats?.memberCount}</span>
                                <span className="profile-stat-label">Member Count</span>
                            </div>
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
            <div className="profile-loading-spinner">Loading...</div>
        </div>
    </div>
);

const ErrorState = ({ error, onRetry }) => (
    <div className="profile-page">
        <Header />
        <div className="profile-container">
            <div className="profile-error-card">
                <p>Error: {error}</p>
                <button onClick={onRetry}>Retry</button>
            </div>
        </div>
    </div>
);

export default ProfilePage;