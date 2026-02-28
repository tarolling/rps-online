import neo4j from "neo4j-driver";
import { NextResponse } from "next/server";
import { getDriver } from "@/lib/neo4j";
import { RANK_TIERS, type Rank } from "@/lib/ranks";

// Map rank name → [minRating, maxRating)
function getRankRatingRange(rank: Rank): [number, number] {
  const tiers = RANK_TIERS.filter((t) => t.rank === rank);
  const min = Math.min(...tiers.map((t) => t.minRating));
  const allMins = RANK_TIERS.map((t) => t.minRating).sort((a, b) => a - b);
  const max = allMins.find((r) => r > Math.max(...tiers.map((t) => t.minRating))) ?? Infinity;
  return [min, max];
}

const QUERIES = {
  rating: (ratingFilter: string) => `
    MATCH (p:Player) ${ratingFilter}
    RETURN p.uid AS uid, p.username AS username, p.rating AS rating,
           p.rating AS statValue
    ORDER BY statValue DESC LIMIT 100
  `,
  gamesPlayed: (ratingFilter: string) => `
    MATCH (p:Player) ${ratingFilter}
    OPTIONAL MATCH (p)-[:PARTICIPATED_IN]->(m:Match)
    WITH p, count(m) AS statValue
    RETURN p.uid AS uid, p.username AS username, p.rating AS rating, statValue
    ORDER BY statValue DESC LIMIT 100
  `,
  winStreak: (ratingFilter: string) => `
    MATCH (p:Player) ${ratingFilter}
    OPTIONAL MATCH (p)-[r:PARTICIPATED_IN]->(m:Match)
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
    RETURN p.uid AS uid, p.username AS username, p.rating AS rating,
          streakStats.best AS statValue
    ORDER BY statValue DESC LIMIT 100
  `,
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") ?? "rating") as keyof typeof QUERIES;
  const rank = searchParams.get("rank") as Rank | null;

  if (!QUERIES[type]) {
    return NextResponse.json({ error: "Invalid leaderboard type." }, { status: 400 });
  }

  let ratingFilter = "";
  if (rank) {
    const [min, max] = getRankRatingRange(rank);
    ratingFilter = max === Infinity
      ? `WHERE p.rating >= ${min}`
      : `WHERE p.rating >= ${min} AND p.rating < ${max}`;
  }

  const driver = getDriver();
  const session = driver.session({ database: "neo4j" });

  try {
    const query = QUERIES[type](ratingFilter);
    const data = await session.executeRead((tx) =>
      tx.run(query).then((result) =>
        result.records.map((r) => ({
          uid: r.get("uid"),
          username: r.get("username"),
          rating: neo4j.integer.toNumber(r.get("rating")),
          statValue: neo4j.integer.toNumber(r.get("statValue")),
        })),
      ),
    );
    return NextResponse.json(data);
  } catch (err) {
    console.error("fetchLeaderboard error:", err);
    return NextResponse.json({ error: "Failed to fetch leaderboard." }, { status: 500 });
  } finally {
    await session.close();
  }
}