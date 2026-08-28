"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { formatRelativeTime } from "@/lib/time";
import styles from "./ProfilePage.module.css";
import { getJSON, postJSON } from "@/lib/api";
import { PlayerMatch } from "@/types/common";
import { getDivisionLabel, getRankTier } from "@/lib/ranks";
import Avatar from "@/components/Avatar";
import { getAvatarUrl, uploadAvatar } from "@/lib/avatar";
import { ProfileData } from "@/types";
import type { ClubAvailability } from "@/types/neo4j";
import FriendButton from "@/components/FriendButton";
import { fetchFriends, FriendEntry } from "@/lib/friends";
import { GAME_MODES } from "@/lib/gameModes";
import { getTitle, RARITY_COLOR } from "@/lib/titles";

type GameStats = {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: string;
};
type HeadToHeadStats = {
  wins: number;
  losses: number;
};
type ClubData = {
  name: string;
  tag: string;
  availability: ClubAvailability;
  memberRole: string; 
  memberCount: number;
};

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, avatarUrl: contextAvatarUrl, setAvatarUrl: setContextAvatarUrl, isPremium } = useAuth();
  const [billingLoading, setBillingLoading] = useState(false);

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [h2hStats, setH2hStats] = useState<HeadToHeadStats | null>(null);
  const [userClub, setUserClub] = useState<ClubData | null>(null);
  const [recentMatches, setRecentMatches] = useState<PlayerMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [otherAvatarUrl, setOtherAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwnProfile = user?.uid === userId;
  // Own profile: use the shared context so header stays in sync.
  // Other profile: use local state fetched independently.
  const avatarUrl = isOwnProfile ? contextAvatarUrl : otherAvatarUrl;

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

  async function fetchStats() {
    setGameStats(null);
    setUserClub(null);
    setRecentMatches([]);
    try {
      const [stats, games, club] = await Promise.allSettled([
        postJSON<{
          rating: number,
          totalGames: number,
          wins: number,
          losses: number,
          winRate: number,
          currentStreak: number,
          bestStreak: number
        } | null>("/api/fetchDashboardStats", { playerId: userId }),
        getJSON<PlayerMatch[]>("/api/fetchRecentGames", { playerId: userId }),
        getJSON<ClubData | null>("/api/clubs/user", { uid: userId }),
      ]);
      if (stats.status === "fulfilled" && stats.value) {
        const d = stats.value;
        setGameStats({
          totalGames: d.totalGames,
          wins: d.wins,
          losses: d.losses,
          winRate: `${d.winRate.toFixed(1)}%`,
        });
      }
      if (games.status === "fulfilled") setRecentMatches(games.value);
      if (club.status === "fulfilled" && club.value) setUserClub(club.value);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  async function fetchHeadToHeadStats(viewerId: string, targetId: string) {
    setH2hStats(null);
    try {
      const stats = await getJSON<{
      wins: number,
      losses: number,
    }>("/api/fetchH2hStats", {
      viewerId,
      targetId,
    });
      setH2hStats({
        wins: stats.wins,
        losses: stats.losses,
      });
    } catch (err) {
      console.error("Error fetching head-to-head stats:", err);
    }
  }

  useEffect(() => {
    fetchProfileData();
    fetchStats();
    if (!isOwnProfile) {
      getAvatarUrl(userId).then(setOtherAvatarUrl);
      if (user) {
        fetchHeadToHeadStats(user?.uid, userId);
      }
    }
  }, [userId]);

  // Coming back from Checkout: the webhook that flips isPremium may land a
  // beat after the redirect, so poll briefly instead of showing stale status.
  const checkoutStatus = searchParams.get("checkout");
  useEffect(() => {
    if (checkoutStatus !== "success" || !isOwnProfile) return;
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      const data = await postJSON<ProfileData>("/api/fetchPlayer", { uid: userId });
      setProfileData(data);
      if (data.isPremium || attempts >= 5) {
        clearInterval(interval);
        router.replace(`/profile/${userId}`);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [checkoutStatus, isOwnProfile, userId, router]);

  // friends
  useEffect(() => {
    if (!isOwnProfile || !user) return;
    fetchFriends(user.uid).then(setFriends);
  }, [isOwnProfile, user?.uid]);

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

  const handleEquipTitle = async (titleId: string | null) => {
    const nextTitleId = profileData?.equippedTitleId === titleId ? null : titleId;
    try {
      await postJSON("/api/titles/equip", { titleId: nextTitleId });
      setProfileData((prev) => prev ? { ...prev, equippedTitleId: nextTitleId } : prev);
    } catch (err: unknown) {
      setError((err as Error).message);
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

  const handleUpgrade = async () => {
    setBillingLoading(true);
    try {
      const { url } = await postJSON<{ url: string }>("/api/billing/createCheckoutSession", {});
      window.location.href = url;
    } catch (err: unknown) {
      setError((err as Error).message);
      setBillingLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setBillingLoading(true);
    try {
      const { url } = await postJSON<{ url: string }>("/api/billing/createPortalSession", {});
      window.location.href = url;
    } catch (err: unknown) {
      setError((err as Error).message);
      setBillingLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !isPremium) return;
    setAvatarError("");
    setAvatarUploading(true);
    try {
      const url = await uploadAvatar(file);
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
            {isOwnProfile && isPremium && (
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
            {isOwnProfile && !isPremium && (
              <button
                className={styles.avatarEditButton}
                onClick={handleUpgrade}
                title="Upgrade to Premium to change your profile picture"
              >
                🔒
              </button>
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
              <h1>
                {profileData?.username || "Player"}
                {profileData?.equippedTitleId && getTitle(profileData.equippedTitleId) && (
                  <span
                    className={styles.equippedTitle}
                    style={{ "--title-color": RARITY_COLOR[getTitle(profileData.equippedTitleId)!.rarity] } as CSSProperties}
                  >
                    {getTitle(profileData.equippedTitleId)!.name}
                  </span>
                )}
              </h1>
            )}
            {avatarError && <span className={styles.fieldError}>{avatarError}</span>}
            {isOwnProfile && (
              <div className={styles.actions}>
                {!isEditing && isPremium && (
                  <button onClick={() => setIsEditing(true)} className={styles.editButton}>Edit Username</button>
                )}
                {!isEditing && !isPremium && (
                  <button className={styles.editButton} disabled title="Upgrade to Premium to change your username">
                    Edit Username
                  </button>
                )}
                <button onClick={handleDeleteAccount} className={styles.deleteButton}>Delete Account</button>
              </div>
            )}
            {!isOwnProfile && profileData && (
              <FriendButton targetId={userId} targetUsername={profileData.username} />
            )}
          </div>
        </section>

        <div className={styles.grid}>
          {isOwnProfile && (
            <section className={`${styles.card} ${styles.premiumCard}`}>
              <h2>⭐ Premium</h2>
              {isPremium ? (
                <>
                  <p className={styles.premiumBody}>You&apos;re subscribed to Premium: unlimited async games, rank flair, and custom username/avatar.</p>
                  <button onClick={handleManageSubscription} disabled={billingLoading} className={styles.premiumButton}>
                    {billingLoading ? "Loading…" : "Manage Subscription"}
                  </button>
                </>
              ) : (
                <>
                  <p className={styles.premiumBody}>$5/mo: unlimited async games, exclusive rank flair, and the ability to change your username and avatar.</p>
                  <button onClick={handleUpgrade} disabled={billingLoading} className={styles.premiumButton}>
                    {billingLoading ? "Loading…" : "Upgrade to Premium"}
                  </button>
                </>
              )}
            </section>
          )}
          {!isOwnProfile && h2hStats && (
            <section className={styles.card}>
              <h2>Head-to-Head</h2>
              <div className={styles.statsGrid}>
                <StatItem value={h2hStats.wins} label="Wins" />
                <StatItem value={h2hStats.losses} label="Losses" />
              </div>
            </section>
          )}
          
          <section className={styles.card}>
            <h2>Statistics</h2>
            {gameStats ? (
              <div className={styles.statsGrid}>
                {profileData?.ratings.blitz !== undefined ?
                  <StatItem value={`${getRankTier(profileData.ratings.blitz).rank} ${getDivisionLabel(getRankTier(profileData.ratings.blitz).division)}`} label="Rank" /> :
                  <StatItem value="N/A" label="Rank" />
                }
                <StatItem value={profileData?.ratings.blitz ?? "N/A"} label="Skill Rating" />
                <StatItem value={profileData?.ratings.async ?? "N/A"} label="Async Rating" />
                <StatItem value={profileData?.ratings.wildcard ?? "N/A"} label="Wildcard Rating" />
                <StatItem value={gameStats.totalGames} label="Games Played" />
                <StatItem value={gameStats.winRate} label="Win Rate" />
                <StatItem value={gameStats.wins} label="Wins" />
                <StatItem value={gameStats.losses} label="Losses" />
              </div>
            ) : (
              <p className={styles.emptyState}>This player has not played any games.</p>
            )}
          </section>

          <section className={styles.card}>
            <h2>Titles</h2>
            {profileData && profileData.earnedTitleIds.length > 0 ? (
              <div className={styles.titleList}>
                {profileData.earnedTitleIds.map((titleId) => {
                  const title = getTitle(titleId);
                  if (!title) return null;
                  const equipped = profileData.equippedTitleId === titleId;
                  return (
                    <div key={titleId} className={styles.titleChip} style={{ "--title-color": RARITY_COLOR[title.rarity] } as CSSProperties}>
                      <div className={styles.titleInfo}>
                        <span className={styles.titleName}>{title.name}</span>
                        <span className={styles.titleDescription}>{title.description}</span>
                      </div>
                      {isOwnProfile && (
                        <button
                          className={`${styles.titleEquipButton} ${equipped ? styles.equipped : ""}`}
                          onClick={() => handleEquipTitle(titleId)}
                        >
                          {equipped ? "Equipped" : "Equip"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={styles.emptyState}>No titles earned yet.</p>
            )}
          </section>

          <section className={styles.card}>
            <h2>Recent Matches</h2>
            {recentMatches.length === 0 ? (
              <p className={styles.emptyState}>No recent matches.</p>
            ) : (
              <div className={styles.matchList}>
                {recentMatches.map((match, i) => (
                  <div key={i} className={`${styles.matchItem} ${styles[match.result.toLowerCase()]}`} onClick={() => router.push(`/match/${match.id}`)}>
                    <Link href={`/profile/${match.opponentId}`} onClick={(e) => e.stopPropagation()} className={styles.matchOpponent}>
                      {match.opponentUsername}
                    </Link>
                    <span className={styles.matchResult}>{match.result}</span>
                    <div className={styles.matchDetails}>
                      <span>{match.playerScore} - {match.opponentScore}</span>
                      <span className={styles.matchDate}>
                        {GAME_MODES[match.mode].label} · {formatRelativeTime(match.date)}
                      </span>
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

          {isOwnProfile && (
            <section className={styles.card}>
              <h2>Friends ({friends.length})</h2>
              {friends.length === 0 ? (
                <p className={styles.emptyState}>You have no friends yet.</p>
              ) : (
                <div className={styles.matchList}>
                  {friends.map((f) => (
                    <div key={f.uid} className={styles.matchItem}>
                      <Link href={`/profile/${f.uid}`} className={styles.matchOpponent}>{f.username}</Link>
                    </div>
                  ))}
                </div>
              )}
              <Link href="/friends" className={styles.friendsButton}>
              Manage friends →
              </Link>
            </section>
          )}
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