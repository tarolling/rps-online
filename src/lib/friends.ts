import { get, getDatabase, onValue, ref } from "firebase/database";
import { getJSON } from "@/lib/api";

const db = getDatabase();

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FriendEntry {
  uid: string;
  username: string;
  since: number;
}

export interface FriendRequest {
  username: string;
  sentAt: number;
}

export interface Challenge {
  fromId: string;
  fromUsername: string;
  sentAt: number;
  status: "pending" | "accepted" | "rejected";
  gameId?: string;
}

/** Only requests live here now; confirmed friends are in Neo4j */
export interface RequestsData {
  incoming: Record<string, FriendRequest>;
  outgoing: Record<string, FriendRequest>;
}

// ── Friends (Neo4j) ───────────────────────────────────────────────────────────

export async function fetchFriends(uid: string): Promise<FriendEntry[]> {
  const data = await getJSON<{ friends: FriendEntry[] }>("/api/friends", { uid });
  return data.friends;
}

export async function getFriendshipStatus(
  myId: string,
  otherId: string,
): Promise<"none" | "friends" | "incoming" | "outgoing"> {
  try {
    const [inSnap, outSnap] = await Promise.all([
      get(ref(db, `friends/${myId}/incoming/${otherId}`)),
      get(ref(db, `friends/${myId}/outgoing/${otherId}`)),
    ]);

    if (inSnap.exists()) return "incoming";
    if (outSnap.exists()) return "outgoing";
  } catch (err) {
    console.error("getFriendshipStatus RTDB error:", err);
  }

  try {
    const friends = await fetchFriends(myId);
    if (friends.some((f) => f.uid === otherId)) return "friends";
  } catch (err) {
    console.error("getFriendshipStatus Neo4j error:", err);
  }

  return "none";
}

// ── Friend Requests (Firebase RTDB) ──────────────────────────────────────────

export function subscribeRequestsData(uid: string, cb: (data: RequestsData) => void) {
  const r = ref(db, `friends/${uid}`);
  return onValue(r, (snap) => {
    const val = snap.val() ?? {};
    cb({
      incoming: val.incoming ?? {},
      outgoing: val.outgoing ?? {},
    });
  });
}

// ── Challenges (Firebase RTDB) ────────────────────────────────────────────────

export function subscribeChallenges(uid: string, cb: (challenges: Record<string, Challenge>) => void) {
  const r = ref(db, `challenges/${uid}`);
  return onValue(r, (snap) => {
    cb(snap.val() ?? {});
  });
}