import React, { useEffect, useState } from 'react';

async function LeaderboardPage() {
    const [playerData, setPlayerData] = useState(null);

    useEffect(async () => {
        let data = await fetch('/api/leaderboard', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        data = await data.json()
        let players = [];
        for (const player of data) {
            players.push(`<tr><th>${player.username}</th></tr>`);
        }

        setPlayerData(players.join(''))
    }, []);

    return (
        <div>
            <h1>Top 100 Players</h1>
            <table>{playerData ?? "Loading leaderboard..."}</table>
        </div>
    )
}

export default LeaderboardPage;