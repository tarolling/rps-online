import { signInAnonymously } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { postJSON } from "@/lib/api";

/**
 * Signs the visitor in as an ephemeral Firebase Auth user and establishes the
 * same session cookie a real login would, without provisioning a Neo4j
 * Player/Rating node — guest games never touch Neo4j (see gameLogic.ts's
 * recordRankedGame guard against Game.isGuest).
 */
export async function signInAsGuest(): Promise<string> {
  const { user } = await signInAnonymously(auth);
  const idToken = await user.getIdToken();
  await postJSON("/api/login", { idToken });
  return user.uid;
}

/** Deterministic, display-only guest name; collisions are inconsequential since it's never used as a lookup key. */
export function guestUsername(uid: string): string {
  return `Guest${uid.slice(-5)}`;
}
