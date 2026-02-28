import neo4j from "neo4j-driver";
import { getDriver } from "@/lib/neo4j";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const matchId = req.nextUrl.searchParams.get("id");
  if (!matchId) {
    return NextResponse.json({ error: "Match ID is required." }, { status: 400 });
  }

  const session = getDriver().session({ database: "neo4j" });
  try {
    const response = await session.executeRead(async (tx) =>
    {
      const matchResult = await tx.run(
        `MATCH (p1:Player)-[r1:PARTICIPATED_IN]->(m:Match {id: $matchId})<-[r2:PARTICIPATED_IN]-(p2:Player)
         RETURN
           m.id           AS matchId,
           m.timestamp    AS timestamp,
           m.totalRounds  AS totalRounds,
           m.winnerId     AS winnerId,
           m.mode         AS mode,
           m.status       AS status,
           p1.uid         AS p1Id,
           p1.username    AS p1Username,
           p1.rating      AS p1Rating,
           r1.score       AS p1Score,
           r1.ratingBefore AS p1RatingBefore,
           r1.ratingAfter  AS p1RatingAfter,
           r1.rocks        AS p1Rocks,
           r1.papers       AS p1Papers,
           r1.scissors     AS p1Scissors,
           p2.uid         AS p2Id,
           p2.username    AS p2Username,
           p2.rating      AS p2Rating,
           r2.score       AS p2Score,
           r2.ratingBefore AS p2RatingBefore,
           r2.ratingAfter  AS p2RatingAfter,
           r2.rocks        AS p2Rocks,
           r2.papers       AS p2Papers,
           r2.scissors     AS p2Scissors`,
        { matchId },
      );

      if (matchResult.records.length === 0) return null;
      const m = matchResult.records[0];

      // Fetch rounds
      const roundsResult = await tx.run(
        `MATCH (m:Match {id: $matchId})-[:HAD_ROUND]->(r:Round)
         RETURN
           r.roundNumber AS roundNumber,
           r.p1Choice    AS p1Choice,
           r.p2Choice    AS p2Choice,
           r.winnerId    AS winnerId
         ORDER BY r.roundNumber ASC`,
        { matchId },
      );

      const toInt = (val: number | null) =>
        val !== null ? neo4j.integer.toNumber(val) : null;

      return {
        match: {
          id: m.get("matchId"),
          timestamp: m.get("timestamp"),
          totalRounds: toInt(m.get("totalRounds")),
          winnerId: m.get("winnerId"),
          mode: m.get("mode"),
          status: m.get("status"),
        },
        player1: {
          uid: m.get("p1Id"),
          username: m.get("p1Username"),
          rating: toInt(m.get("p1Rating")),
          score: toInt(m.get("p1Score")),
          ratingBefore: toInt(m.get("p1RatingBefore")),
          ratingAfter: toInt(m.get("p1RatingAfter")),
          rocks: toInt(m.get("p1Rocks")),
          papers: toInt(m.get("p1Papers")),
          scissors: toInt(m.get("p1Scissors")),
        },
        player2: {
          uid: m.get("p2Id"),
          username: m.get("p2Username"),
          rating: toInt(m.get("p2Rating")),
          score: toInt(m.get("p2Score")),
          ratingBefore: toInt(m.get("p2RatingBefore")),
          ratingAfter: toInt(m.get("p2RatingAfter")),
          rocks: toInt(m.get("p2Rocks")),
          papers: toInt(m.get("p2Papers")),
          scissors: toInt(m.get("p2Scissors")),
        },
        rounds: roundsResult.records.map((r) => ({
          roundNumber: toInt(r.get("roundNumber")),
          p1Choice: r.get("p1Choice"),
          p2Choice: r.get("p2Choice"),
          // different winnerId (either "player1", "player2" or "draw")
          winnerId: r.get("winnerId"),
        })),
      };
    },
    );
    return NextResponse.json(response);
  } catch (err) {
    console.error("fetchMatchDetail error:", err);
    return NextResponse.json({ error: "Failed to fetch match detail." }, { status: 500 });
  } finally {
    await session.close();
  }
}