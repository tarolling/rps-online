"use client";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LeaderboardPage() {
    const [playerData, setPlayerData] = useState(null);

    const router = useRouter();

    useEffect(() => {
        const fetchLeaderboard = async () => {
            const response = await fetch('/api/fetchLeaderboard', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
            }

            response.json().then((data) => {
                setPlayerData(data.leaderboardData);
            });
        };

        fetchLeaderboard().catch((err) => {
            console.error(err);
            setPlayerData([]);
        });
    }, []);

    return (
        <div>
            <Header />
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
                                <tr key={index} onClick={() => router.push(`/profile/${player.uid}`)}>
                                    <td>{player.username}</td>
                                    <td>{player.rating}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            <Footer />
        </div>
    );
}