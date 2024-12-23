import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import Header from './Header';
import Logo from './Logo';
import { useAuth } from '../Auth';

function HomePage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [username, setUsername] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
                setUsername(data.username);
            } catch (err) {
                console.error('Error fetching player:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchPlayer();
    }, [user]);

    if (loading) {
        return (
            <div>
                <Header />
                <div className="container">
                    <div className="card">
                        <Logo />
                        <p>Loading data...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div>
                <Header />
                <div className="container">
                    <div className="card">
                        <Logo />
                        <p>Error: {error}</p>
                        <button onClick={() => window.location.reload()}>Retry</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <Header />
            <div className="container">
                <div className="card">
                    <Logo />
                    <h2>Welcome, {username}!</h2>
                    <button onClick={() => navigate('/play')}>Play RPS</button>
                    <button onClick={() => navigate('/leaderboard')}>View Leaderboard</button>
                    <button onClick={() => navigate('/friends')}>Friends</button>
                </div>
            </div>
        </div>
    );
}

export default HomePage;
