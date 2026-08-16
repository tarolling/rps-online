import { NextRequest, NextResponse } from "next/server";

/**
 * Wraps an API route handler so any thrown/rejected error becomes a
 * standardized `{ error }` JSON 500 response instead of an uncaught
 * exception (which Next.js turns into an opaque, unlogged 500). Explicit
 * error responses (auth failures, validation) should still be returned
 * directly from the handler via `NextResponse.json(..., { status })` —
 * this only catches what the handler itself doesn't.
 */
export function withErrorHandling<Args extends unknown[]>(
  routeName: string,
  handler: (req: NextRequest, ...args: Args) => Promise<NextResponse>,
): (req: NextRequest, ...args: Args) => Promise<NextResponse> {
  return async (req, ...args) => {
    try {
      return await handler(req, ...args);
    } catch (err) {
      console.error(`${routeName} error:`, err);
      return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
  };
}
