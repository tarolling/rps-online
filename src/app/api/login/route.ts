import { adminAuth } from "@/lib/firebaseAdmin";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_EXPIRY_COOKIE,
  SESSION_MAX_AGE_MS,
} from "@/lib/sessionCookie";

/**
 * Mints the httpOnly `session` cookie from a Firebase ID token.
 *
 * Called on sign-in and again whenever the client's session is due for
 * renewal (see src/lib/session.ts), which is what lets a session slide
 * forward for as long as someone keeps using the app.
 */
export async function POST(request: Request) {
  let idToken: unknown;
  try {
    ({ idToken } = await request.json());
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  if (typeof idToken !== "string" || !idToken) {
    return NextResponse.json({ error: "An ID token is required." }, { status: 400 });
  }

  try {
    // Verified up front so a bad token fails here rather than surfacing later
    // as a cookie that never passes verifySessionCookie.
    await adminAuth.verifyIdToken(idToken);

    // NOTE: deliberately NO auth_time freshness check, despite Firebase's docs
    // recommending one before minting a session cookie. This endpoint is also
    // the sliding-session renewal: a renewal presents a *refreshed* ID token
    // whose auth_time is still the ORIGINAL sign-in, possibly days back, so a
    // 5-minute freshness rule would cap every session at 5 minutes. Do not
    // "fix" this.
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
    const expiresAt = Date.now() + SESSION_MAX_AGE_MS;

    const response = NextResponse.json({ ok: true, expiresAt });
    const shared = {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: SESSION_MAX_AGE_MS / 1000,
      path: "/",
    };
    response.cookies.set(SESSION_COOKIE, sessionCookie, { httpOnly: true, ...shared });
    // Readable on purpose: it carries no secret, only the expiry the client
    // needs in order to tell whether a server session exists and when to
    // renew it. Never trusted for authorization.
    response.cookies.set(SESSION_EXPIRY_COOKIE, String(expiresAt), { httpOnly: false, ...shared });
    return response;
  } catch (err) {
    console.error("login: could not mint a session cookie", err);
    return NextResponse.json({ error: "Could not sign you in. Please try again." }, { status: 401 });
  }
}
