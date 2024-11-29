import React from 'react';
import Logo from './Logo';

function Dashboard({ session, onNavigate }) {
    return (
        <div className="container">
            <div className="card">
                <Logo />
                <h2>Dashboard</h2>
                <button onClick={() => onNavigate('game')}>Play Game</button>
                <button onClick={() => onNavigate('leaderboard')}>View Leaderboard</button>
                <button onClick={() => onNavigate('friends')}>Friends</button>
            </div>
        </div>
    );
}

export default Dashboard;
