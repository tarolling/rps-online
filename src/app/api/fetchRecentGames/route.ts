import { getDriver } from "@/lib/neo4j";
import { MatchResult } from "@/types/neo4j";
import neo4j from "neo4j-driver";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const playerId = req.nextUrl.searchParams.get("playerId");

  const session = getDriver().session({ database: "neo4j" });

  try {
    const response = await session.executeRead(async (tx) => {
      if (playerId) {
        const data = await tx.run(`
          MATCH (p:Player {uid: $playerId})-[r1:PARTICIPATED_IN]->(m:Match)<-[r2:PARTICIPATED_IN]-(opp:Player)
          ORDER BY m.timestamp DESC
          LIMIT 3
          RETURN opp.uid AS uid,
          opp.username AS username,
          r1.result AS result,
          r1.score AS playerScore,
          r2.score AS opponentScore,
          m.timestamp AS date
        `,
        { playerId },
        );

        return data.records.map((record) => ({
          opponentId: record.get("uid"),
          opponentUsername: record.get("username"),
          result: record.get("result") === MatchResult.Win ? "Win" : "Loss",
          playerScore: neo4j.integer.toNumber(record.get("playerScore")),
          opponentScore: neo4j.integer.toNumber(record.get("opponentScore")),
          date: record.get("date"),
        }));
      } else {
        const data = await tx.run(`
          MATCH (p1:Player)-[r1:PARTICIPATED_IN]->(m:Match)<-[r2:PARTICIPATED_IN]-(p2:Player)
          WHERE elementId(p1) < elementId(p2)
          ORDER BY m.timestamp DESC
          LIMIT 3
          RETURN m.id AS id,
              p1.uid AS playerOneId,
              p1.username AS playerOneUsername,
              p2.uid AS playerTwoId, 
              p2.username AS playerTwoUsername,
              m.winnerId AS winner,
              r1.score AS playerOneScore,
              r2.score AS playerTwoScore,
              m.timestamp AS timestamp
        `);

        return data.records.map((record) => {
          const playerOneScore = neo4j.integer.toNumber(record.get("playerOneScore"));
          const playerTwoScore = neo4j.integer.toNumber(record.get("playerTwoScore"));
          return {
            id: record.get("id"),
            player1: record.get("playerOneUsername"),
            player2: record.get("playerTwoUsername"),
            playerOneId: record.get("playerOneId"),
            playerTwoId: record.get("playerTwoId"),
            winner: record.get("winner") === record.get("playerOneId") ? record.get("playerOneUsername") : record.get("playerTwoUsername"),
            score: `${playerOneScore}-${playerTwoScore}`,
            timestamp: record.get("timestamp"),
          };
        });
      }
    });

    return NextResponse.json(response);
  } catch (err) {
    console.error("Error fetching recent games:", err);
    return NextResponse.json({ error: "Failed to fetch recent games." }, { status: 500 });
  } finally {
    await session.close();
  }
}