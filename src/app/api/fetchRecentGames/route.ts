import { getRecentGames } from "@/lib/recentGames";
import { isValidPlayMode } from "@/lib/gameModes";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const playerId = req.nextUrl.searchParams.get("playerId");
  const modeParam = req.nextUrl.searchParams.get("mode");

  if (modeParam !== null && !isValidPlayMode(modeParam)) {
    return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
  }

  try {
    const response = await getRecentGames(playerId, modeParam);
    return NextResponse.json(response);
  } catch (err) {
    console.error("Error fetching recent games:", err);
    return NextResponse.json({ error: "Failed to fetch recent games." }, { status: 500 });
  }
}
