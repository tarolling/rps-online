"use client";

import { signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ApiError, postJSON } from "@/lib/api";
import {
  SESSION_EXPIRY_COOKIE,
  needsSessionRefresh,
  parseSessionExpiry,
} from "@/lib/sessionCookie";

/**
 * Owns the lifecycle of the server session cookie on the client.
 *
 * Firebase's client session persists in IndexedDB indefinitely and refreshes
 * its own ID token, while the server session cookie has a fixed lifetime.
 * Left alone the two drift apart and the app ends up rendering logged-in
 * chrome for a user the server no longer recognizes. Everything that mints
 * or clears that cookie goes through this module so the two stay reconciled.
 */

/**
 * Reads a cookie by name from `document.cookie`.
 * @param name - The cookie name
 */
function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** The current session's expiry, or null when there's no server session. */
export function sessionExpiresAt(): number | null {
  if (typeof document === "undefined") return null;
  return parseSessionExpiry(readCookie(SESSION_EXPIRY_COOKIE));
}

/**
 * Whether a server session exists with enough life left to use as-is.
 * @param now - Current time in epoch milliseconds, injectable for tests
 */
export function hasFreshSession(now: number = Date.now()): boolean {
  return !needsSessionRefresh(sessionExpiresAt(), now);
}

let inFlight: Promise<void> | null = null;

/**
 * Mints or renews the httpOnly session cookie from the user's ID token.
 *
 * A no-op when the expiry hint says the cookie still has plenty of life,
 * unless `force` is set, which both skips that check and demands a freshly
 * refreshed ID token. Force is for the paths that can't trust the hint:
 * just-completed sign-ins, and recovery from a 401.
 * @param user - The signed-in Firebase user
 * @param options - Pass `force` to renew unconditionally
 */
export async function establishSession(user: User, { force = false }: { force?: boolean } = {}): Promise<void> {
  if (!force && hasFreshSession()) return;

  if (inFlight) {
    await inFlight;
    // A forced caller needs a genuinely fresh token, so it can't settle for
    // riding on somebody else's in-flight mint.
    if (!force) return;
  }

  const run = (async () => {
    const idToken = await user.getIdToken(force);
    await postJSON<{ expiresAt: number }>("/api/login", { idToken });
  })();
  // Tracked as a settled-either-way promise so a failed mint doesn't reject
  // whoever is merely waiting behind it.
  inFlight = run.then(() => undefined, () => undefined);
  try {
    await run;
  } finally {
    inFlight = null;
  }
}

/** Deletes the server session and its expiry hint. Never throws. */
export async function clearSession(): Promise<void> {
  try {
    await postJSON("/api/logout", {});
  } catch (err) {
    console.warn("Could not clear the server session:", err);
  }
}

/**
 * The single logout path.
 *
 * Server first, deliberately: while the cookie is still valid the request is
 * authenticated, so `/api/logout` can verify it and revoke the refresh
 * tokens. Signing out of Firebase first would send an unauthenticated
 * request and strand a live cookie behind a signed-out UI. Never throws, so
 * callers can always navigate afterwards.
 */
export async function signOutEverywhere(): Promise<void> {
  await clearSession();
  try {
    await signOut(auth);
  } catch (err) {
    console.error("Could not sign out of Firebase:", err);
  }
}

/** True when a failure means the identity itself is dead, not just the network. */
export function isUnauthorizedError(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}
