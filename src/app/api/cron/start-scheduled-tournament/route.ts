import { NextRequest, NextResponse } from "next/server";
import { clearExpiredTournaments, startScheduledTournaments } from "@/lib/tournaments.server";
import { withErrorHandling } from "@/lib/apiHandler";

const CRON_SECRET = process.env.CRON_SECRET;

export const POST = withErrorHandling("start-scheduled-tournament cron", async (req: NextRequest) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await startScheduledTournaments();
  await clearExpiredTournaments();
  return NextResponse.json({ success: true });
});