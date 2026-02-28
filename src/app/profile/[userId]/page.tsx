"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import formatRelativeTime from "@/lib/time";
import styles from "./ProfilePage.module.css";
import { getJSON, postJSON } from "@/lib/api";
import { Match } from "@/types/common";
import { getRankTier } from "@/lib/ranks";
import Avatar from "@/components/Avatar";
import { getAvatarUrl, uploadAvatar } from "@/lib/avatar";
import { ProfileData } from "@/types";
import type { ClubAvailability } from "@/types/neo4j";

type GameStats = { totalGames: number; winRate: string; currentStreak: number; bestStreak: number };
type ClubData = { name: string; tag: string; availability: ClubAvailability, memberRole: string; memberCount: number };

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const { user, avatarUrl: contextAvatarUrl, setAvatarUrl: setContextAvatarUrl } = useAuth();

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [userClub, setUserClub] = useState<ClubData | null>(null);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [otherAvatarUrl, setOtherAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwnProfile = user?.uid === userId;
  // Own profile: use the shared context so header stays in sync.
  // Other profile: use local state fetched independently.
  const avatarUrl = isOwnProfile ? contextAvatarUrl : otherAvatarUrl;

  useEffect(() => {
    fetchProfileData();
    fetchStats();
    if (!isOwnProfile) {
      getAvatarUrl(userId).then(setOtherAvatarUrl);
    }
  }, [userId]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await postJSON<ProfileData>("/api/fetchPlayer", { uid: userId });
      setProfileData(data);
      setNewUsername(data.username);
    } catch (err: unknown) {
      setError((err as Error).message);
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
        postJSON<{        
          rating: number,
          totalGames: number,
          winRate: number,
          currentStreak: number,
          bestStreak: number
        } | null>("/api/fetchDashboardStats", { playerId: userId }),
        getJSON<Match[]>("/api/fetchRecentGames", { playerId: userId }),
        getJSON<ClubData | null>("/api/clubs/user", { uid: userId }),
      ]);
      if (stats.status === "fulfilled" && stats.value) {
        const d = stats.value;
        setGameStats({ totalGames: d.totalGames, winRate: `${d.winRate.toFixed(1)}%`, currentStreak: d.currentStreak, bestStreak: d.bestStreak });
      }
      if (games.status === "fulfilled") setRecentMatches(games.value);
      if (club.status === "fulfilled" && club.value) setUserClub(club.value);
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
      const { usernameExists } = await postJSON<{ usernameExists: boolean }>("/api/checkUsername", { username: newUsername });
      if (usernameExists) throw new Error("Username is already taken.");
      await postJSON("/api/updateUsername", { uid: userId, newUsername });
      setProfileData((prev) => prev ? { ...prev, username: newUsername } : prev);
      setIsEditing(false);
    } catch (err: unknown) {
      setUsernameError((err as Error).message);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you sure you want to delete your account? This cannot be undone.")) return;
    try {
      await user!.delete();
      await postJSON("/api/deleteAccount", { uid: userId });
      router.replace("/login");
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setAvatarError("");
    setAvatarUploading(true);
    try {
      const url = await uploadAvatar(user.uid, file);
      setContextAvatarUrl(url); // updates header + this page simultaneously
    } catch (err: unknown) {
      setAvatarError((err as Error).message);
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={fetchProfileData} />;

  return (
    <div className="app">
      <Header />
      <main className={styles.container}>
        <section className={styles.profileHeader}>
          <div className={styles.avatarWrapper}>
            <Avatar src={avatarUrl} username={profileData?.username} size="lg" />
            {isOwnProfile && (
              <>
                <button
                  className={styles.avatarEditButton}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  title="Change profile picture"
                >
                  {avatarUploading ? "..." : "✏️"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className={styles.hiddenInput}
                  onChange={handleAvatarChange}
                />
              </>
            )}
          </div>
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
            {avatarError && <span className={styles.fieldError}>{avatarError}</span>}
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

        <div className={styles.grid}>
          <section className={styles.card}>
            <h2>Statistics</h2>
            {gameStats ? (
              <div className={styles.statsGrid}>
                {profileData ?
                  <StatItem value={`${getRankTier(profileData.rating).rank} ${getRankTier(profileData.rating).division}`} label="Rank" /> :
                  <StatItem value="N/A" label="Rank" />
                }
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

          <section className={styles.card}>
            <h2>Recent Matches</h2>
            {recentMatches.length === 0 ? (
              <p className={styles.emptyState}>No recent matches.</p>
            ) : (
              <div className={styles.matchList}>
                {recentMatches.map((match, i) => (
                  <div key={i} className={`${styles.matchItem} ${styles[match.result.toLowerCase()]}`}>
                    <Link href={`/profile/${match.opponentID}`} onClick={(e) => e.stopPropagation()} className={styles.matchOpponent}>
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

const StatItem = ({ value, label }: { value: string | number; label: string }) => (
  <div className={styles.statItem}>
    <span className={styles.statValue}>{value}</span>
    <span className={styles.statLabel}>{label}</span>
  </div>
);

const LoadingState = () => (
  <div className="app"><Header /><main className={styles.container}><p className={styles.emptyState} style={{ marginTop: "4rem" }}>Loading...</p></main><Footer /></div>
);

const ErrorState = ({ error, onRetry }: { error: string; onRetry: () => void }) => (
  <div className="app"><Header /><main className={styles.container}><div className={styles.errorCard}><p>Error: {error}</p><button onClick={onRetry}>Retry</button></div></main><Footer /></div>
);

export default ProfilePage;