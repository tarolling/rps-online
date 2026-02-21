"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import styles from "./LeaderboardPage.module.css";

type Player = {
    uid: string;
    username: string;
    rating: number;
};

function LeaderboardPage() {
    const [playerData, setPlayerData] = useState<Player[] | null>(null);
    const router = useRouter();

    useEffect(() => {
        fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/fetchLeaderboard`)
            .then((res) => {
                if (!res.ok) throw new Error(res.statusText);
                return res.json();
            })
            .then((data) => setPlayerData(data.leaderboardData))
            .catch((err) => {
                console.error(err);
                setPlayerData([]);
            });
    }, []);

    return (
        <div className="app">
            <Header />
            <main className={styles.main}>
                <h1>Top 100 Players</h1>

                {playerData === null ? (
                    <p className={styles.status}>Loading leaderboard...</p>
                ) : playerData.length === 0 ? (
                    <p className={styles.status}>No data available.</p>
                ) : (
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th className={styles.rankCol}>#</th>
                                    <th>Username</th>
                                    <th className={styles.ratingCol}>Rating</th>
                                </tr>
                            </thead>
                            <tbody>
                                {playerData.map((player, index) => (
                                    <tr
                                        key={player.uid}
                                        className={styles.row}
                                        onClick={() => router.push(`/profile/${player.uid}`)}
                                    >
                                        <td className={styles.rank}>{index + 1}</td>
                                        <td className={styles.username}>
                                            <Link
                                                href={`/profile/${player.uid}`}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {player.username}
                                            </Link>
                                        </td>
                                        <td className={styles.rating}>{player.rating}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
            <Footer />
        </div>
    );
}

export default LeaderboardPage;