"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import formatRelativeTime from "@/lib/time";
import styles from "./ProfilePage.module.css";
import { DateTime } from "neo4j-driver";
import { getJSON, postJSON } from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────

type ProfileData = { username: string; rating: number };
type GameStats = { totalGames: number; winRate: string; currentStreak: number; bestStreak: number };
type ClubData = { name: string; tag: string; memberRole: string; memberCount: number };
type Match = { opponentID: string; opponentUsername: string; result: string; playerScore: number; opponentScore: number; date: DateTime };

// ── Helpers ──────────────────────────────────────────────────────────────────

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

// ── Component ─────────────────────────────────────────────────────────────────

function ProfilePage() {
    const { userId } = useParams<{ userId: string }>();
    const router = useRouter();
    const { user } = useAuth();

    const [profileData, setProfileData] = useState<ProfileData | null>(null);
    const [gameStats, setGameStats] = useState<GameStats | null>(null);
    const [userClub, setUserClub] = useState<ClubData | null>(null);
    const [recentMatches, setRecentMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [newUsername, setNewUsername] = useState("");
    const [usernameError, setUsernameError] = useState("");

    const isOwnProfile = user?.uid === userId;

    useEffect(() => {
        fetchProfileData();
        fetchStats();
    }, [userId]);

    const fetchProfileData = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await postJSON<ProfileData>("/api/fetchPlayer", { uid: userId });
            setProfileData(data);
            setNewUsername(data.username);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        setGameStats(null);
        setUserClub(null);
        setRecentMatches([]);
        try {
            const [stats, games, club] = await Promise.allSettled([
                postJSON("/api/fetchDashboardStats", { playerId: userId }),
                getJSON("/api/fetchRecentGames", { playerId: userId }),
                postJSON("/api/clubs", { methodType: "user", uid: userId }),
            ]);

            if (stats.status === "fulfilled" && !stats.value.error) {
                const d = stats.value;
                setGameStats({ totalGames: d.totalGames, winRate: `${d.winRate.toFixed(1)}%`, currentStreak: d.currentStreak, bestStreak: d.bestStreak });
            }
            if (games.status === "fulfilled" && !games.value.error) {
                setRecentMatches(games.value);
            }
            if (club.status === "fulfilled" && !club.value.error) {
                setUserClub(club.value);
            }
        } catch (err) {
            console.error("Error fetching stats:", err);
        }
    };

    const handleUpdateUsername = async () => {
        setUsernameError("");
        if (!USERNAME_REGEX.test(newUsername)) {
            setUsernameError("3-20 chars: letters, numbers, and underscores only.");
            return;
        }
        try {
            const { usernameExists } = await postJSON("/api/checkUsername", { username: newUsername });
            if (usernameExists) throw new Error("Username is already taken.");
            await postJSON("/api/updateUsername", { uid: userId, newUsername });
            setProfileData((prev) => prev ? { ...prev, username: newUsername } : prev);
            setIsEditing(false);
        } catch (err: any) {
            setUsernameError(err.message);
        }
    };

    const handleDeleteAccount = async () => {
        if (!window.confirm("Are you sure you want to delete your account? This cannot be undone.")) return;
        try {
            await user!.delete();
            await postJSON("/api/deleteAccount", { uid: userId });
            router.replace("/login");
        } catch (err: any) {
            setError(err.message);
        }
    };

    if (loading) return <LoadingState />;
    if (error) return <ErrorState error={error} onRetry={fetchProfileData} />;

    return (
        <div className="app">
            <Header />
            <main className={styles.container}>

                {/* ── Header ── */}
                <section className={styles.profileHeader}>
                    <div className={styles.profileInfo}>
                        {isEditing ? (
                            <div className={styles.usernameEdit}>
                                <div className={styles.usernameEditRow}>
                                    <input
                                        type="text"
                                        value={newUsername}
                                        onChange={(e) => setNewUsername(e.target.value.trim())}
                                        className={styles.usernameInput}
                                        autoFocus
                                    />
                                    <button onClick={handleUpdateUsername} className={styles.saveButton}>Save</button>
                                    <button onClick={() => { setIsEditing(false); setUsernameError(""); }} className={styles.cancelButton}>Cancel</button>
                                </div>
                                {usernameError && <span className={styles.fieldError}>{usernameError}</span>}
                            </div>
                        ) : (
                            <h1>{profileData?.username || "Player"}</h1>
                        )}

                        {isOwnProfile && (
                            <div className={styles.actions}>
                                {!isEditing && (
                                    <button onClick={() => setIsEditing(true)} className={styles.editButton}>Edit Username</button>
                                )}
                                <button onClick={handleDeleteAccount} className={styles.deleteButton}>Delete Account</button>
                            </div>
                        )}
                    </div>
                </section>

                {/* ── Grid ── */}
                <div className={styles.grid}>

                    {/* Stats */}
                    <section className={styles.card}>
                        <h2>Statistics</h2>
                        {gameStats ? (
                            <div className={styles.statsGrid}>
                                <StatItem value={profileData?.rating ?? "N/A"} label="Skill Rating" />
                                <StatItem value={gameStats.totalGames} label="Games Played" />
                                <StatItem value={gameStats.winRate} label="Win Rate" />
                                <StatItem value={gameStats.currentStreak} label="Current Streak" />
                                <StatItem value={gameStats.bestStreak} label="Best Streak" />
                            </div>
                        ) : (
                            <p className={styles.emptyState}>This player has not played any games.</p>
                        )}
                    </section>

                    {/* Recent Matches */}
                    <section className={styles.card}>
                        <h2>Recent Matches</h2>
                        {recentMatches.length === 0 ? (
                            <p className={styles.emptyState}>No recent matches.</p>
                        ) : (
                            <div className={styles.matchList}>
                                {recentMatches.map((match, i) => (
                                    <div key={i} className={`${styles.matchItem} ${styles[match.result.toLowerCase()]}`}>
                                        <Link href={`/profile/${match.opponentID}`} className={styles.matchOpponent}>
                                            {match.opponentUsername}
                                        </Link>
                                        <span className={styles.matchResult}>{match.result}</span>
                                        <div className={styles.matchDetails}>
                                            <span>{match.playerScore} - {match.opponentScore}</span>
                                            <span className={styles.matchDate}>{formatRelativeTime(match.date)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Club */}
                    <section className={styles.card}>
                        <h2>Club</h2>
                        {userClub ? (
                            <div className={styles.statsGrid}>
                                <StatItem value={userClub.name} label="Club Name" />
                                <StatItem value={userClub.tag} label="Club Tag" />
                                <StatItem value={userClub.memberRole} label="Role" />
                                <StatItem value={userClub.memberCount} label="Members" />
                            </div>
                        ) : (
                            <p className={styles.emptyState}>This player is not in a club.</p>
                        )}
                    </section>

                </div>
            </main>
            <Footer />
        </div>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const StatItem = ({ value, label }: { value: string | number; label: string }) => (
    <div className={styles.statItem}>
        <span className={styles.statValue}>{value}</span>
        <span className={styles.statLabel}>{label}</span>
    </div>
);

const LoadingState = () => (
    <div className="app">
        <Header />
        <main className={styles.container}>
            <p className={styles.emptyState} style={{ marginTop: "4rem" }}>Loading...</p>
        </main>
        <Footer />
    </div>
);

const ErrorState = ({ error, onRetry }: { error: string; onRetry: () => void }) => (
    <div className="app">
        <Header />
        <main className={styles.container}>
            <div className={styles.errorCard}>
                <p>Error: {error}</p>
                <button onClick={onRetry}>Retry</button>
            </div>
        </main>
        <Footer />
    </div>
);

export default ProfilePage;