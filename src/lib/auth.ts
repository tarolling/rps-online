import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";

/** Verifies the session cookie and returns the authenticated uid, or null. */
export async function getAuthedUid(req: NextRequest): Promise<string | null> {
  const session = req.cookies.get("session")?.value;
  if (!session) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    return decoded.uid;
  } catch {
    return null;
  }
}