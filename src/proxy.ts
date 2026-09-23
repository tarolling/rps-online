import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, isSessionCookieExpired } from "@/lib/sessionCookie";

/**
 * Optimistic auth gate, nothing more.
 *
 * It reads the session cookie and checks its `exp` WITHOUT a signature check
 * or a network call, per Next's own guidance: proxy runs on every matched
 * request, prefetches included, so a verifySessionCookie round trip here
 * costs a call to Firebase per prefetch and makes page rendering depend on
 * Firebase Auth being reachable.
 *
 * Real authorization lives in getAuthedUid (src/lib/auth.ts), which every
 * route serving private data or accepting a mutation calls. Everything behind
 * this matcher is a client component whose data comes from those routes (or
 * from RTDB under its own security rules), so the worst case here is a
 * revoked-but-unexpired cookie reaching an empty page shell that then fails
 * its own authenticated fetches. If any of these routes is ever converted to
 * a server component, it needs its own getAuthedUid check.
 */
export function proxy(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (!isSessionCookieExpired(session)) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

// Scoped positively to the protected prefixes, which excludes /api, _next/*
// and public/ automatically. Both the bare and :path* forms are listed rather
// than relying on :path* to match an empty segment. Unlike the previous
// startsWith check, these are segment-anchored, so /dashboardxyz no longer
// matches.
export const config = {
  matcher: [
    "/dashboard", "/dashboard/:path*",
    "/friends", "/friends/:path*",
    "/clubs", "/clubs/:path*",
    "/tournaments", "/tournaments/:path*",
  ],
};
