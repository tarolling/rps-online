import React, { useEffect, useState } from 'react';

function LeaderboardPage() {
    const [playerData, setPlayerData] = useState(null);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const response = await fetch('/api/leaderboard', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
                console.log(`RESPONSE: ${response}`);

                if (!response.ok) {
                    throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
                }

                const data = await data.json()
                console.log(`bruh what ${data}`)
                setPlayerData(data)
            } catch (error) {
                console.error(error);
                setPlayerData([]);
            }
        };

        fetchLeaderboard();
    }, []);

    return (
        <div style={{ padding: '20px' }}>
            <h1>Top 100 Players</h1>
            {playerData === null ? (
                <p>Loading leaderboard...</p>
            ) : playerData.length === 0 ? (
                <p>No data available.</p>
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Rating</th>
                        </tr>
                    </thead>
                    <tbody>
                        {playerData.map((player, index) => (
                            <tr key={index}>
                                <td>{player.username}</td>
                                <td>{player.rating}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

export default LeaderboardPage;