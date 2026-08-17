import neo4j from "neo4j-driver";
import { NextResponse } from "next/server";
import { runQuery } from "@/lib/neo4j";
import { getRankRatingRange, RANK_SUMMARY } from "@/lib/ranks";
import type { RankName } from "@/types";
import { GAME_MODES, isValidPlayMode } from "@/lib/gameModes";



const QUERIES = {
  rating: (ratingFilter: string) => `
    MATCH (p:Player)-[:HAS_RATING]->(rt:Rating {mode: $mode}) ${ratingFilter}
    RETURN p.uid AS uid, p.username AS username, rt.value AS rating,
           rt.value AS statValue
    ORDER BY statValue DESC LIMIT 100
  `,
  gamesPlayed: (ratingFilter: string) => `
    MATCH (p:Player)-[:HAS_RATING]->(rt:Rating {mode: $mode}) ${ratingFilter}
    OPTIONAL MATCH (p)-[:PARTICIPATED_IN]->(m:Match {mode: $matchMode})
    WITH p, rt, count(m) AS statValue
    RETURN p.uid AS uid, p.username AS username, rt.value AS rating, statValue
    ORDER BY statValue DESC LIMIT 100
  `,
  winStreak: (ratingFilter: string) => `
    MATCH (p:Player)-[:HAS_RATING]->(rt:Rating {mode: $mode}) ${ratingFilter}
    OPTIONAL MATCH (p)-[r:PARTICIPATED_IN]->(m:Match {mode: $matchMode})
    WITH p, rt, collect({result: r.result, timestamp: m.timestamp}) AS games
    WITH p, rt, apoc.coll.sortMaps(games, "timestamp") AS sortedAsc
    WITH p, rt, reduce(streaks = {current: 0, best: 0}, g IN sortedAsc |
      CASE
        WHEN g.result = 'W' THEN {
          current: streaks.current + 1,
          best: CASE WHEN streaks.current + 1 > streaks.best THEN streaks.current + 1 ELSE streaks.best END
        }
        ELSE { current: 0, best: streaks.best }
      END
    ) AS streakStats
    RETURN p.uid AS uid, p.username AS username, rt.value AS rating,
          streakStats.best AS statValue
    ORDER BY statValue DESC LIMIT 100
  `,
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") ?? "rating") as keyof typeof QUERIES;
  const rank = searchParams.get("rank") as RankName | null;
  const mode = searchParams.get("mode") ?? "blitz";

  if (!QUERIES[type]) {
    return NextResponse.json({ error: "Invalid leaderboard type." }, { status: 400 });
  }
  if (!isValidPlayMode(mode)) {
    return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
  }
  if (rank && !RANK_SUMMARY.includes(rank)) {
    return NextResponse.json({ error: "Invalid rank." }, { status: 400 });
  }

  const matchMode = GAME_MODES[mode].matchMode;

  let ratingFilter = "";
  if (rank) {
    const [min, max] = getRankRatingRange(rank);
    ratingFilter = max === Infinity
      ? `WHERE rt.value >= ${min}`
      : `WHERE rt.value >= ${min} AND rt.value < ${max}`;
  }

  try {
    const query = QUERIES[type](ratingFilter);
    const result = await runQuery(query, { matchMode, mode });
    const data = result.records.map((r) => ({
      uid: r.get("uid"),
      username: r.get("username"),
      rating: neo4j.integer.toNumber(r.get("rating")),
      statValue: neo4j.integer.toNumber(r.get("statValue")),
    }));
    return NextResponse.json(data);
  } catch (err) {
    console.error("fetchLeaderboard error:", err);
    return NextResponse.json({ error: "Failed to fetch leaderboard." }, { status: 500 });
  }
}