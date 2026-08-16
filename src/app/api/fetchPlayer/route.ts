import { runQuery } from "@/lib/neo4j";
import neo4j from "neo4j-driver";
import { NextRequest, NextResponse } from "next/server";
import config from "@/config/settings.json";

export async function POST(req: NextRequest) {
  const { uid } = await req.json();

  if (!uid) {
    return NextResponse.json({ error: "UID is required." }, { status: 400 });
  }

  try {
    const result = await runQuery(`
      MATCH (p:Player {uid: $uid})
      RETURN p.username AS username, p.rating AS rating, p.asyncRating AS asyncRating
      `, { uid });

    if (result.records.length === 0) {
      throw new Error("No players with the specified user ID exists.");
    }
    const read = result.records[0];

    const asyncRating = read.get("asyncRating");
    return NextResponse.json({
      username: read.get("username"),
      rating: neo4j.integer.toNumber(read.get("rating")),
      // fall back for players created before asyncRating existed / not yet backfilled
      asyncRating: asyncRating !== null && asyncRating !== undefined ? neo4j.integer.toNumber(asyncRating) : config.defaultRating,
    });
  } catch (err) {
    console.error("fetchPlayer error:", err);
    return NextResponse.json({ error: "Failed to fetch player." }, { status: 500 });
  }
}