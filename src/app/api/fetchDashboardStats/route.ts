import { NextRequest, NextResponse } from "next/server";
import neo4j from "neo4j-driver";
import { getDriver } from "@/lib/neo4j";

export async function POST(req: NextRequest) {
  const { playerId } = await req.json();

  if (!playerId) {
    return NextResponse.json({ error: "Player ID is required." }, { status: 400 });
  }

  const driver = getDriver();
  const session = driver.session({ database: "neo4j" });

  try {
    const response = await session.executeRead(async (tx) => {
      const data = await tx.run(`
        MATCH (p:Player {uid: $playerId})-[r:PARTICIPATED_IN]->(m:Match)
        WITH 
          p,
          collect({result: r.result, timestamp: m.timestamp}) AS games
        WITH
          p,
          games,
          size([g IN games WHERE g.result = 'W']) AS totalWins,
          size(games) AS totalGames
        WITH
          p,
          totalGames,
          totalWins,
          toFloat(totalWins) / totalGames * 100 AS winPercentage,
          apoc.coll.sortMaps(games, "timestamp") AS sortedAsc
        WITH
          p,
          totalGames,
          winPercentage,
          reverse(sortedAsc) AS sortedDesc
        WITH
          p,
          totalGames,
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
          p.rating AS rating,
          totalGames,
          winPercentage AS winRate,
          streakStats.current AS currentStreak,
          streakStats.best AS bestStreak
            `, {
        playerId,
      });

      if (data.records.length === 0) {
        return null;
      }

      return {
        rating: neo4j.integer.toNumber(data.records[0].get("rating")),
        totalGames: neo4j.integer.toNumber(data.records[0].get("totalGames")),
        winRate: neo4j.integer.toNumber(data.records[0].get("winRate")),
        currentStreak: neo4j.integer.toNumber(data.records[0].get("currentStreak")),
        bestStreak: neo4j.integer.toNumber(data.records[0].get("bestStreak")),
      };
    });

    return NextResponse.json(response);
  } catch (err) {
    console.error("fetchDashboardStats error:", err);
    return NextResponse.json({ error: "Failed to fetch dashboard stats." }, { status: 500 });
  } finally {
    await session.close();
  }
}