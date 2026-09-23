/**
 * Maps Firebase Auth error codes to copy we're willing to show a user.
 *
 * Firebase's own `error.message` reads like `Firebase: Error
 * (auth/invalid-credential).`, which tells a player nothing and leaks the
 * provider. Every auth surface (login, register, OAuth) should route its
 * caught errors through `authErrorMessage` instead of reading `.message`.
 */

const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/invalid-email": "That doesn't look like a valid email address.",
  "auth/user-not-found": "Incorrect email or password.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/user-disabled": "This account has been disabled. Contact support if you think that's a mistake.",
  "auth/email-already-in-use": "An account with that email already exists.",
  "auth/weak-password": "Please choose a stronger password.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/requires-recent-login": "Please log in again to continue.",
  "auth/popup-blocked": "Your browser blocked the sign-in popup. Allow popups for this site and try again.",
  "auth/account-exists-with-different-credential":
    "An account with that email already exists, but with a different sign-in method.",
  "auth/operation-not-allowed": "That sign-in method isn't enabled. Please try another one.",
};

const FALLBACK = "Something went wrong. Please try again.";

/** Reads a Firebase `code` off an unknown caught value, if it has one. */
export function authErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/**
 * Turns a caught auth error into user-facing copy.
 * @param error - The caught value, normally a FirebaseError
 * @param fallback - Copy to use when the code isn't one we recognize
 */
export function authErrorMessage(error: unknown, fallback: string = FALLBACK): string {
  const code = authErrorCode(error);
  if (code && code in MESSAGES) return MESSAGES[code];

  // Our own API routes return human-readable `{ error }` copy, which ApiError
  // surfaces as `message`. Pass that through, but never a raw Firebase string
  // like "Firebase: Error (auth/invalid-credential)." — those are for logs.
  if (!code) {
    const message = (error as { message?: unknown } | null)?.message;
    if (typeof message === "string" && message && !message.startsWith("Firebase:")) return message;
  }
  return fallback;
}

/** True for the codes that mean "the user changed their mind", which shouldn't surface as errors. */
export function isUserCanceled(error: unknown): boolean {
  const code = authErrorCode(error);
  return (
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request" ||
    code === "auth/user-cancelled"
  );
}
