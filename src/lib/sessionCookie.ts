/**
 * Shared, dependency-free facts about the session cookies.
 *
 * Imported by the login/logout routes, the proxy, and the client-side
 * session manager, so it must stay free of both the Firebase client SDK and
 * firebase-admin.
 */

/** The httpOnly cookie carrying the Firebase session JWT. */
export const SESSION_COOKIE = "session";

/**
 * Companion to `SESSION_COOKIE`, carrying only its expiry as epoch
 * milliseconds. Deliberately readable by the client: `document.cookie` can't
 * see an httpOnly cookie, so without this the client has no way to tell
 * "a healthy server session exists" from "the cookie is gone" except by
 * firing a request and eating a 401. Advisory only, never trusted for
 * authorization.
 */
export const SESSION_EXPIRY_COOKIE = "session_expires";

/** Firebase caps session cookies at 14 days; 5 keeps the existing posture. */
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

/** Re-mint once the cookie has less than this much life left. */
export const SESSION_REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Parses the expiry hint cookie's value.
 * @param raw - The raw cookie value
 * @returns The expiry in epoch milliseconds, or null if absent or unusable
 */
export function parseSessionExpiry(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Whether the server session cookie is due for renewal.
 * @param expiresAt - The cookie's expiry, or null when there isn't one
 * @param now - Current time in epoch milliseconds, injectable for tests
 * @param window - How much remaining life counts as "due"
 */
export function needsSessionRefresh(
  expiresAt: number | null,
  now: number = Date.now(),
  window: number = SESSION_REFRESH_WINDOW_MS,
): boolean {
  if (expiresAt === null) return true;
  return expiresAt - now <= window;
}

/**
 * Reads the `exp` claim from a JWT WITHOUT verifying its signature.
 *
 * Only ever used for optimistic checks in the proxy. Real verification is
 * `adminAuth.verifySessionCookie` in `getAuthedUid`.
 * @param token - A JWT
 * @returns The `exp` claim in seconds, or null if the token is unreadable
 */
export function decodeJwtExp(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    // Decode via TextDecoder rather than bare atob: Firebase session cookies
    // carry a `name` claim that may hold non-ASCII, which atob would mangle.
    const bytes = Uint8Array.from(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );
    const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof payload !== "object" || payload === null) return null;
    const exp = (payload as { exp?: unknown }).exp;
    return typeof exp === "number" && Number.isFinite(exp) ? exp : null;
  } catch {
    return null;
  }
}

/**
 * Whether a session cookie is missing, unreadable, or past its `exp`.
 * @param token - The raw session cookie value
 * @param now - Current time in epoch milliseconds, injectable for tests
 */
export function isSessionCookieExpired(token: string | undefined, now: number = Date.now()): boolean {
  if (!token) return true;
  const exp = decodeJwtExp(token);
  return exp === null || exp * 1000 <= now;
}
