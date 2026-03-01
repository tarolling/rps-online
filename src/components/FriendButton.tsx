"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDatabase, onValue, ref } from "firebase/database";
import { useAuth } from "@/context/AuthContext";
import { getFriendshipStatus } from "@/lib/friends";
import { postJSON } from "@/lib/api";
import styles from "./FriendButton.module.css";

interface Props {
  targetId: string;
  targetUsername: string;
}

type FriendStatus = "none" | "friends" | "incoming" | "outgoing" | "loading" | "error";

export default function FriendButton({ targetId, targetUsername }: Props) {
  const { user, username } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<FriendStatus>("loading");
  const [busy, setBusy] = useState(false);
  const [challengeStatus, setChallengeStatus] = useState<"idle" | "pending">("idle");

  const refreshStatus = () => {
    if (!user) { setStatus("error"); return; }
    getFriendshipStatus(user.uid, targetId)
      .then(setStatus)
      .catch((err) => { console.error("FriendButton: failed to get status", err); setStatus("error"); });
  };

  useEffect(() => { refreshStatus(); }, [user?.uid, targetId]);

  if (!user || user.uid === targetId) return null;
  if (status === "loading") return <span className={styles.muted}>…</span>;
  if (status === "error") return null;

  const callFriends = async (action: string) => {
    if (!username) return;
    setBusy(true);
    try {
      await postJSON("/api/friends", { action, myId: user.uid, myUsername: username, otherId: targetId, otherUsername: targetUsername });
      refreshStatus();
    } catch (err) {
      console.error("FriendButton action failed:", err);
    } finally {
      setBusy(false);
    }
  };

  const handleChallenge = async () => {
    if (!username) return;
    setBusy(true);
    try {
      await postJSON("/api/challenges", { action: "send", fromId: user.uid, fromUsername: username, toId: targetId });
      setChallengeStatus("pending");

      // Watch for recipient to accept
      const db = getDatabase();
      const challengeRef = ref(db, `challenges/${targetId}/${user.uid}`);
      const unsub = onValue(challengeRef, (snap) => {
        const val = snap.val();
        if (val?.gameId) {
          unsub();
          router.push(`/game/${val.gameId}`);
        }
        if (!snap.exists()) {
          unsub();
          setChallengeStatus("idle");
        }
      });
    } catch (e: unknown) {
      alert((e as Error).message ?? "Failed to send challenge.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.group}>
      {status === "none" && (
        <button className={styles.addBtn} onClick={() => callFriends("send")} disabled={busy}>
          {busy ? "..." : "➕ Add Friend"}
        </button>
      )}
      {status === "outgoing" && (
        <button className={styles.cancelBtn} onClick={() => callFriends("cancel")} disabled={busy}>
          {busy ? "..." : "✉️ Request Sent"}
        </button>
      )}
      {status === "incoming" && (
        <button className={styles.acceptBtn} onClick={() => callFriends("accept")} disabled={busy}>
          {busy ? "..." : "✅ Accept Request"}
        </button>
      )}
      {status === "friends" && (
        <>
          {challengeStatus === "pending" ? (
            <span className={styles.muted}>Waiting for response...</span>
          ) : (
            <button className={styles.challengeBtn} onClick={handleChallenge} disabled={busy}>
              {busy ? "..." : "⚔️ Challenge"}
            </button>
          )}
          <button className={styles.removeBtn} onClick={() => callFriends("remove")} disabled={busy}>
            Remove Friend
          </button>
        </>
      )}
    </div>
  );
}