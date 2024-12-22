import React from 'react';
import { useNavigate } from 'react-router';
import { Header } from './Header';
import Logo from './Logo';

function HomePage() {
    const navigate = useNavigate();

    return (
        <div>
            <Header />
            <div className="container">
                <div className="card">
                    <Logo />
                    <h2>Dashboard</h2>
                    <button onClick={() => navigate('/game')}>Play Game</button>
                    <button onClick={() => navigate('/leaderboard')}>View Leaderboard</button>
                    <button onClick={() => navigate('/friends')}>Friends</button>
                </div>
            </div>
        </div>
    );
}

export default HomePage;
