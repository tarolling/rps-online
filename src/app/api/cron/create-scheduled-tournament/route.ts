import { NextRequest, NextResponse } from "next/server";
import { createTournament } from "@/lib/tournaments.server";
import { withErrorHandling } from "@/lib/apiHandler";

const CRON_SECRET = process.env.CRON_SECRET;

export const POST = withErrorHandling("create-scheduled-tournament cron", async (req: NextRequest) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scheduledStartTime = Date.now() + 50 * 60 * 1000; // start in 50 minutes
  await createTournament(`Hourly Tournament - ${new Date().toUTCString()}`, "Automatically scheduled tournament.", 8, scheduledStartTime);
  return NextResponse.json({ success: true });
});