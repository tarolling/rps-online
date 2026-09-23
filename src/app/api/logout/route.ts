import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { SESSION_COOKIE, SESSION_EXPIRY_COOKIE } from "@/lib/sessionCookie";

/**
 * Ends the server session.
 *
 * Revokes the user's refresh tokens, which signs them out everywhere rather
 * than just in this browser. That is the point: `getAuthedUid` verifies with
 * `checkRevoked: true`, so revocation is the only thing that can kill a
 * captured session cookie before its natural expiry.
 */
export async function POST(req: NextRequest) {
  const session = req.cookies.get(SESSION_COOKIE)?.value;

  // Cookies are cleared unconditionally and first: a verification or
  // revocation failure must never leave the browser holding a live session,
  // and logging out has to succeed even when Firebase is unreachable.
  const response = NextResponse.json({ ok: true });
  response.cookies.delete({ name: SESSION_COOKIE, path: "/" });
  response.cookies.delete({ name: SESSION_EXPIRY_COOKIE, path: "/" });

  if (session) {
    try {
      const decoded = await adminAuth.verifySessionCookie(session);
      await adminAuth.revokeRefreshTokens(decoded.uid);
    } catch (err) {
      console.warn("logout: could not revoke the session", err);
    }
  }

  return response;
}
