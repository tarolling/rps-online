import { getMatchHistory } from "@/lib/matchHistory";
import { isValidPlayMode } from "@/lib/gameModes";
import { NextRequest, NextResponse } from "next/server";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const playerId = req.nextUrl.searchParams.get("playerId");
  const modeParam = req.nextUrl.searchParams.get("mode");
  const pageParam = req.nextUrl.searchParams.get("page");

  if (!playerId) {
    return NextResponse.json({ error: "playerId is required." }, { status: 400 });
  }
  if (modeParam !== null && !isValidPlayMode(modeParam)) {
    return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
  }

  const page = pageParam ? Number(pageParam) : 1;
  if (!Number.isInteger(page) || page < 1) {
    return NextResponse.json({ error: "Invalid page." }, { status: 400 });
  }

  try {
    const response = await getMatchHistory(playerId, modeParam, page, PAGE_SIZE);
    return NextResponse.json(response);
  } catch (err) {
    console.error("Error fetching match history:", err);
    return NextResponse.json({ error: "Failed to fetch match history." }, { status: 500 });
  }
}
