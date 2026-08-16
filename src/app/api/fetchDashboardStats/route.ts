import { NextRequest, NextResponse } from "next/server";
import neo4j from "neo4j-driver";
import { runQuery } from "@/lib/neo4j";
import type { PlayMode } from "@/types";

export async function POST(req: NextRequest) {
  const { playerId, mode = "blitz" } = await req.json();

  if (!playerId) {
    return NextResponse.json({ error: "Player ID is required." }, { status: 400 });
  }

  if (mode !== "blitz" && mode !== "async") {
    return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
  }
  const matchMode = (mode as PlayMode) === "async" ? "ranked_async" : "ranked";
  const ratingField = (mode as PlayMode) === "async" ? "asyncRating" : "rating";

  try {
    const data = await runQuery(`
        MATCH (p:Player {uid: $playerId})-[r:PARTICIPATED_IN]->(m:Match {mode: $matchMode})
        WITH
          p,
          collect({result: r.result, timestamp: m.timestamp}) AS games
        WITH
          p,
          games,
          size([g IN games WHERE g.result = 'W']) AS wins,
          size([g IN games WHERE g.result = 'L']) AS losses,
          size(games) AS totalGames
        WITH
          p,
          totalGames,
          wins,
          losses,
          toFloat(wins) / totalGames * 100 AS winPercentage,
          apoc.coll.sortMaps(games, "timestamp") AS sortedAsc
        WITH
          p,
          totalGames,
          wins,
          losses,
          winPercentage,
          reverse(sortedAsc) AS sortedDesc
        WITH
          p,
          totalGames,
          wins,
          losses,
          winPercentage,
          reduce(streaks = {current: 0, best: 0}, g IN sortedDesc |
              CASE
                  WHEN g.result = 'W' THEN {
                      current: streaks.current + 1,
                      best: CASE WHEN streaks.current + 1 > streaks.best THEN streaks.current + 1 ELSE streaks.best END
                  }
                  ELSE {
                      current: 0,
                      best: streaks.best
                  }
              END
          ) AS streakStats
        RETURN
          p.${ratingField} AS rating,
          totalGames,
          wins,
          losses,
          winPercentage AS winRate,
          streakStats.current AS currentStreak,
          streakStats.best AS bestStreak
            `, {
      playerId,
      matchMode,
    });

    if (data.records.length === 0) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      rating: neo4j.integer.toNumber(data.records[0].get("rating")),
      totalGames: neo4j.integer.toNumber(data.records[0].get("totalGames")),
      wins: neo4j.integer.toNumber(data.records[0].get("wins")),
      losses: neo4j.integer.toNumber(data.records[0].get("losses")),
      winRate: neo4j.integer.toNumber(data.records[0].get("winRate")),
      currentStreak: neo4j.integer.toNumber(data.records[0].get("currentStreak")),
      bestStreak: neo4j.integer.toNumber(data.records[0].get("bestStreak")),
    });
  } catch (err) {
    console.error("fetchDashboardStats error:", err);
    return NextResponse.json({ error: "Failed to fetch dashboard stats." }, { status: 500 });
  }
}