import { getMatchDetail } from "@/lib/matchDetail";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const matchId = req.nextUrl.searchParams.get("id");
  if (!matchId) {
    return NextResponse.json({ error: "Match ID is required." }, { status: 400 });
  }

  try {
    const response = await getMatchDetail(matchId);
    return NextResponse.json(response);
  } catch (err) {
    console.error("fetchMatchDetail error:", err);
    return NextResponse.json({ error: "Failed to fetch match detail." }, { status: 500 });
  }
}
