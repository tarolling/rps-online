import { adminFirestore } from "@/lib/firebaseAdmin";

/** Admin-SDK equivalent of `getAvatarUrl` (src/lib/avatar.ts) for server-only code (e.g. OG image generation). */
export async function getAvatarUrlServer(uid: string): Promise<string | null> {
  try {
    const snap = await adminFirestore.collection("avatars").doc(uid).get();
    return snap.exists ? (snap.data()!.base64 as string) : null;
  } catch {
    return null;
  }
}
