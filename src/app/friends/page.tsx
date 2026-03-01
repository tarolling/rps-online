"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Avatar from "@/components/Avatar";
import { postJSON } from "@/lib/api";
import { getDatabase, onValue, ref } from "firebase/database";
import {
  subscribeRequestsData,
  subscribeChallenges,
  fetchFriends,
  FriendEntry,
  RequestsData,
  Challenge,
} from "@/lib/friends";
import styles from "./FriendsPage.module.css";

export default function FriendsPage() {
  const { user, username } = useAuth();
  const router = useRouter();

  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [requests, setRequests] = useState<RequestsData>({ incoming: {}, outgoing: {} });
  const [challenges, setChallenges] = useState<Record<string, Challenge>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadFriends = () => {
    if (!user) return;
    fetchFriends(user.uid).then(setFriends).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!user) return;

    loadFriends();
    const unsubRequests = subscribeRequestsData(user.uid, (data) => {
      setRequests(data);
      // Re-fetch friends whenever a request is accepted (incoming disappears)
      loadFriends();
    });
    const unsubChallenges = subscribeChallenges(user.uid, setChallenges);

    return () => {
      unsubRequests();
      unsubChallenges();
    };
  }, [user?.uid]);

  // Redirect when a challenge is accepted
  useEffect(() => {
    for (const [, c] of Object.entries(challenges)) {
      if (c.status === "accepted" && c.gameId) {
        postJSON("/api/challenges", { action: "clear", fromId: c.fromId, toId: user!.uid });
        router.push(`/game/${c.gameId}`);
        return;
      }
    }
  }, [challenges]);

  const callFriends = async (action: string, otherId: string, otherUsername?: string) => {
    if (!user || !username) return;
    setActionLoading(`${action}-${otherId}`);
    setError(null);
    try {
      await postJSON("/api/friends", { action, myId: user.uid, myUsername: username, otherId, otherUsername });
      if (action === "accept" || action === "remove") loadFriends();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptChallenge = async (fromId: string) => {
    if (!user) return;
    setActionLoading(`challenge-${fromId}`);
    setError(null);
    try {
      const res = await postJSON<{ gameId: string }>("/api/challenges", {
        action: "accept",
        fromId,
        toId: user.uid,
      });
      if (res.gameId) router.push(`/game/${res.gameId}`);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectChallenge = async (fromId: string) => {
    if (!user) return;
    setActionLoading(`challenge-reject-${fromId}`);
    try {
      await postJSON("/api/challenges", { action: "reject", fromId, toId: user.uid });
    } finally {
      setActionLoading(null);
    }
  };

  const isLoading = (key: string) => actionLoading === key;
  const pendingChallenges = Object.entries(challenges).filter(([, c]) => c.status === "pending");

  return (
    <div className="app">
      <Header />
      <main className={styles.container}>
        <h1>Friends</h1>

        {error && <p className={styles.error}>{error}</p>}

        {/* Incoming Challenges */}
        {pendingChallenges.length > 0 && (
          <section className={styles.section}>
            <h2>⚔️ Incoming Challenges</h2>
            <div className={styles.list}>
              {pendingChallenges.map(([fromId, c]) => (
                <div key={fromId} className={`${styles.row} ${styles.challengeRow}`}>
                  <Link href={`/profile/${fromId}`} className={styles.userInfo}>
                    <Avatar username={c.fromUsername} size="sm" />
                    <span className={styles.username}>{c.fromUsername}</span>
                  </Link>
                  <span className={styles.challengeLabel}>challenges you to a match!</span>
                  <div className={styles.actions}>
                    <button className={styles.acceptBtn} onClick={() => handleAcceptChallenge(fromId)} disabled={!!actionLoading}>
                      {isLoading(`challenge-${fromId}`) ? "..." : "Accept"}
                    </button>
                    <button className={styles.rejectBtn} onClick={() => handleRejectChallenge(fromId)} disabled={!!actionLoading}>
                      {isLoading(`challenge-reject-${fromId}`) ? "..." : "Decline"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Incoming Friend Requests */}
        {Object.keys(requests.incoming).length > 0 && (
          <section className={styles.section}>
            <h2>📬 Friend Requests</h2>
            <div className={styles.list}>
              {Object.entries(requests.incoming).map(([fromId, req]) => (
                <div key={fromId} className={styles.row}>
                  <Link href={`/profile/${fromId}`} className={styles.userInfo}>
                    <Avatar username={req.username} size="sm" />
                    <span className={styles.username}>{req.username}</span>
                  </Link>
                  <div className={styles.actions}>
                    <button className={styles.acceptBtn} onClick={() => callFriends("accept", fromId, req.username)} disabled={!!actionLoading}>
                      {isLoading(`accept-${fromId}`) ? "..." : "Accept"}
                    </button>
                    <button className={styles.rejectBtn} onClick={() => callFriends("reject", fromId)} disabled={!!actionLoading}>
                      {isLoading(`reject-${fromId}`) ? "..." : "Decline"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Outgoing Requests */}
        {Object.keys(requests.outgoing).length > 0 && (
          <section className={styles.section}>
            <h2>📤 Sent Requests</h2>
            <div className={styles.list}>
              {Object.entries(requests.outgoing).map(([toId, req]) => (
                <div key={toId} className={styles.row}>
                  <Link href={`/profile/${toId}`} className={styles.userInfo}>
                    <Avatar username={req.username} size="sm" />
                    <span className={styles.username}>{req.username}</span>
                  </Link>
                  <span className={styles.mutedLabel}>Pending</span>
                  <button className={styles.removeBtn} onClick={() => callFriends("cancel", toId)} disabled={!!actionLoading}>
                    {isLoading(`cancel-${toId}`) ? "..." : "Cancel"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Friends List */}
        <section className={styles.section}>
          <h2>👥 Friends ({friends.length})</h2>
          {loading ? (
            <p className={styles.muted}>Loading...</p>
          ) : friends.length === 0 ? (
            <p className={styles.muted}>No friends yet. Find players on the <Link href="/leaderboard">leaderboard</Link> and add them!</p>
          ) : (
            <div className={styles.list}>
              {friends.map((f) => (
                <div key={f.uid} className={styles.row}>
                  <Link href={`/profile/${f.uid}`} className={styles.userInfo}>
                    <Avatar username={f.username} size="sm" />
                    <span className={styles.username}>{f.username}</span>
                  </Link>
                  <div className={styles.actions}>
                    <ChallengeButton
                      friendId={f.uid}
                      myId={user!.uid}
                      myUsername={username!}
                      disabled={!!actionLoading}
                    />
                    <button className={styles.removeBtn} onClick={() => callFriends("remove", f.uid)} disabled={!!actionLoading}>
                      {isLoading(`remove-${f.uid}`) ? "..." : "Remove"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}

function ChallengeButton({ friendId, myId, myUsername, disabled }: {
  friendId: string;
  myId: string;
  myUsername: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "pending" | "loading">("idle");

  const handleChallenge = async () => {
    setStatus("loading");
    try {
      await postJSON("/api/challenges", { action: "send", fromId: myId, fromUsername: myUsername, toId: friendId });
      setStatus("pending");

      // Watch for recipient to accept — gameId appears on the challenge entry
      const db = getDatabase();
      const challengeRef = ref(db, `challenges/${friendId}/${myId}`);
      const unsub = onValue(challengeRef, (snap) => {
        const val = snap.val();
        if (val?.gameId) {
          unsub();
          router.push(`/game/${val.gameId}`);
        }
        // Entry removed means rejected
        if (!snap.exists()) {
          unsub();
          setStatus("idle");
        }
      });
    } catch {
      setStatus("idle");
    }
  };

  if (status === "pending") return <span className={styles.mutedLabel}>Waiting for response...</span>;

  return (
    <button className={styles.challengeBtn} onClick={handleChallenge} disabled={disabled || status === "loading"}>
      {status === "loading" ? "..." : "⚔️ Challenge"}
    </button>
  );
}