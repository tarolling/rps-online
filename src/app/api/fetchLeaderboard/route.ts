import neo4j from "neo4j-driver";
import { NextResponse } from "next/server";
import { getDriver } from "@/lib/neo4j";

export async function GET() {
  const driver = getDriver();
  const session = driver.session({ database: "neo4j" });

  try {
    const leaderboard = await session.executeRead((tx) =>
      tx.run(`
        MATCH (p:Player)
        ORDER BY p.rating DESC
        LIMIT 100
        RETURN p.uid AS uid, p.username AS username, p.rating AS rating`,
      ).then((result) =>
        result.records.map((r) => ({
          uid: r.get("uid"),
          username: r.get("username"),
          rating: neo4j.integer.toNumber(r.get("rating")),
        })),
      ),
    );

    return NextResponse.json({ leaderboardData: leaderboard });
  } catch (err) {
    console.error("fetchLeaderboard error:", err);
    return NextResponse.json({ error: "Failed to fetch leaderboard." }, { status: 500 });
  } finally {
    await session.close();
  }
}