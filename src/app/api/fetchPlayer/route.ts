import { runQuery } from "@/lib/neo4j";
import neo4j, { Integer } from "neo4j-driver";
import { NextRequest, NextResponse } from "next/server";
import config from "@/config/settings.json";
import { PLAY_MODES } from "@/lib/gameModes";
import type { PlayMode } from "@/types";

export async function POST(req: NextRequest) {
  const { uid } = await req.json();

  if (!uid) {
    return NextResponse.json({ error: "UID is required." }, { status: 400 });
  }

  try {
    const result = await runQuery(`
      MATCH (p:Player {uid: $uid})
      OPTIONAL MATCH (p)-[:HAS_RATING]->(r:Rating)
      RETURN p.username AS username, collect({mode: r.mode, value: r.value}) AS ratings
      `, { uid });

    if (result.records.length === 0) {
      throw new Error("No players with the specified user ID exists.");
    }
    const read = result.records[0];

    const ratingsByMode = new Map<string, number>();
    for (const entry of read.get("ratings") as { mode: string | null; value: number | Integer }[]) {
      if (entry.mode !== null) ratingsByMode.set(entry.mode, neo4j.integer.toNumber(entry.value));
    }

    // Players who predate a mode (or haven't been backfilled) fall back to the default rating.
    const ratings = Object.fromEntries(
      PLAY_MODES.map((mode) => [mode, ratingsByMode.get(mode) ?? config.defaultRating]),
    ) as Record<PlayMode, number>;

    return NextResponse.json({
      username: read.get("username"),
      ratings,
    });
  } catch (err) {
    console.error("fetchPlayer error:", err);
    return NextResponse.json({ error: "Failed to fetch player." }, { status: 500 });
  }
}