import neo4j from "neo4j-driver";
import { NextResponse } from "next/server";
import { runQuery } from "@/lib/neo4j";
import { getRankRatingRange, RANK_SUMMARY } from "@/lib/ranks";
import type { PlayMode, RankName } from "@/types";



const QUERIES = {
  rating: (ratingFilter: string, ratingField: string) => `
    MATCH (p:Player) ${ratingFilter}
    RETURN p.uid AS uid, p.username AS username, p.${ratingField} AS rating,
           p.${ratingField} AS statValue
    ORDER BY statValue DESC LIMIT 100
  `,
  gamesPlayed: (ratingFilter: string, ratingField: string) => `
    MATCH (p:Player) ${ratingFilter}
    OPTIONAL MATCH (p)-[:PARTICIPATED_IN]->(m:Match {mode: $matchMode})
    WITH p, count(m) AS statValue
    RETURN p.uid AS uid, p.username AS username, p.${ratingField} AS rating, statValue
    ORDER BY statValue DESC LIMIT 100
  `,
  winStreak: (ratingFilter: string, ratingField: string) => `
    MATCH (p:Player) ${ratingFilter}
    OPTIONAL MATCH (p)-[r:PARTICIPATED_IN]->(m:Match {mode: $matchMode})
    WITH p, collect({result: r.result, timestamp: m.timestamp}) AS games
    WITH p, apoc.coll.sortMaps(games, "timestamp") AS sortedAsc
    WITH p, reduce(streaks = {current: 0, best: 0}, g IN sortedAsc |
      CASE
        WHEN g.result = 'W' THEN {
          current: streaks.current + 1,
          best: CASE WHEN streaks.current + 1 > streaks.best THEN streaks.current + 1 ELSE streaks.best END
        }
        ELSE { current: 0, best: streaks.best }
      END
    ) AS streakStats
    RETURN p.uid AS uid, p.username AS username, p.${ratingField} AS rating,
          streakStats.best AS statValue
    ORDER BY statValue DESC LIMIT 100
  `,
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") ?? "rating") as keyof typeof QUERIES;
  const rank = searchParams.get("rank") as RankName | null;
  const mode = (searchParams.get("mode") ?? "blitz") as PlayMode;

  if (!QUERIES[type]) {
    return NextResponse.json({ error: "Invalid leaderboard type." }, { status: 400 });
  }
  if (mode !== "blitz" && mode !== "async") {
    return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
  }
  if (rank && !RANK_SUMMARY.includes(rank)) {
    return NextResponse.json({ error: "Invalid rank." }, { status: 400 });
  }

  const ratingField = mode === "async" ? "asyncRating" : "rating";
  const matchMode = mode === "async" ? "ranked_async" : "ranked";

  let ratingFilter = "";
  if (rank) {
    const [min, max] = getRankRatingRange(rank);
    ratingFilter = max === Infinity
      ? `WHERE p.${ratingField} >= ${min}`
      : `WHERE p.${ratingField} >= ${min} AND p.${ratingField} < ${max}`;
  }

  try {
    const query = QUERIES[type](ratingFilter, ratingField);
    const result = await runQuery(query, { matchMode });
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