/** Paths we never bounce back to after login, since they'd loop. */
const LOOPING_PATHS = ["/login", "/register"];

/**
 * Validates a `?next=` value before using it for navigation.
 *
 * Only same-origin absolute paths are allowed, so a crafted link can't bounce
 * a freshly authenticated user off-site.
 * @param raw - The raw query parameter value
 * @returns A safe path to navigate to, or null if it isn't usable
 */
export function sanitizeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Rejects absolute URLs, "javascript:", and anything relative.
  if (!raw.startsWith("/")) return null;
  // Protocol-relative ("//evil.com") and the backslash variant browsers
  // normalize into one.
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (LOOPING_PATHS.some((path) => raw === path || raw.startsWith(`${path}?`) || raw.startsWith(`${path}/`))) {
    return null;
  }
  return raw;
}
