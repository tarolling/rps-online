import { NextRequest, NextResponse } from "next/server";
import { sweepExpiredAsyncRounds } from "@/lib/matchmakingServer";

/**
 * Vercel Cron backstop for async games: force-resolves any round whose 24h
 * deadline has passed. Only a backstop — most rounds resolve immediately via
 * `/api/games/submitChoice` once both players have acted. Schedule is set in
 * `vercel.json`; on the Hobby plan this can only run once/day, so a round
 * where neither player acts could sit expired for up to ~24h before this
 * sweeps it, which is harmless since FIRST_TO still eventually ends the match.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sweepExpiredAsyncRounds();
    return NextResponse.json(result);
  } catch (err) {
    console.error("resolveAsyncRounds cron error:", err);
    return NextResponse.json({ error: "Failed to sweep async rounds." }, { status: 500 });
  }
}
