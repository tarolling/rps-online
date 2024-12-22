import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { auth } from "../api/firebase";
import Header from './Header';
import Logo from './Logo';

function HomePage() {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const userInfo = auth.currentUser;

    useEffect(() => {
        const fetchPlayer = async () => {
            const response = await fetch('/api/fetchPlayer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ uid: userInfo.user.uid })
            });

            if (!response.ok) {
                throw new Error("Unable to update player in database.");
            }

            const data = await response.json();
            console.log(`player data: ${data}`);
            setUsername(data.username);
        }

        fetchPlayer();
    }, [userInfo]);


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
