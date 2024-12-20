import React from 'react';
import Logo from './Logo';
import { useNavigate } from 'react-router';
import { auth } from '../api/firebase';
import { signOut } from 'firebase/auth';

function HomePage() {
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate("/login");
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    return (
        <div className="container">
            <div className="card">
                <Logo />
                <h2>Dashboard</h2>
                <button onClick={() => navigate('/game')}>Play Game</button>
                <button onClick={() => navigate('/leaderboard')}>View Leaderboard</button>
                <button onClick={() => navigate('/friends')}>Friends</button>
                <button onClick={handleLogout}>Logout</button>

            </div>
        </div>
    );
}

export default HomePage;
