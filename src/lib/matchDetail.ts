import neo4j, { DateTime } from "neo4j-driver";
import { getDriver } from "@/lib/neo4j";
import { Choice, MatchStatus, type GameMode } from "@/types/neo4j";

export interface MatchDetail {
  match: {
    id: string,
    timestamp: DateTime,
    totalRounds: number,
    winnerId: string,
    p1Id: string,
    mode: GameMode,
    status: MatchStatus,
  },
  player1: {
    uid: string,
    username: string,
    rating: number,
    score: number,
    ratingBefore: number,
    ratingAfter: number,
    rocks: number,
    papers: number,
    scissors: number,
  },
  player2: {
    uid: string,
    username: string,
    rating: number,
    score: number,
    ratingBefore: number,
    ratingAfter: number,
    rocks: number,
    papers: number,
    scissors: number,
  },
  rounds: {
    roundNumber: number,
    p1Choice: Choice,
    p2Choice: Choice,
    winnerId: string,
  }[],
}

/**
 * Fetches full match detail (players, scores, per-round choices) for a single
 * match. Shared by the API route and by Server Components that need this data
 * at render time (avoids a self-fetch over HTTP, which breaks under Vercel
 * Deployment Protection on preview builds).
 */
export async function getMatchDetail(matchId: string): Promise<MatchDetail | null> {
  const session = getDriver().session({ database: process.env.NEO4J_DATABASE });
  try {
    return await session.executeRead(async (tx): Promise<MatchDetail | null> => {
      const matchResult = await tx.run(`
        MATCH (m:Match {id: $matchId})
        MATCH (p1:Player {uid: m.p1Id})-[r1:PARTICIPATED_IN]->(m)<-[r2:PARTICIPATED_IN]-(p2:Player)
        RETURN
          m.id            AS matchId,
          m.timestamp     AS timestamp,
          m.totalRounds   AS totalRounds,
          m.winnerId      AS winnerId,
          m.p1Id          AS matchP1Id,
          m.mode          AS mode,
          m.status        AS status,
          p1.uid          AS p1Id,
          p1.username     AS p1Username,
          p1.rating       AS p1Rating,
          r1.score        AS p1Score,
          r1.ratingBefore AS p1RatingBefore,
          r1.ratingAfter  AS p1RatingAfter,
          r1.rocks        AS p1Rocks,
          r1.papers       AS p1Papers,
          r1.scissors     AS p1Scissors,
          p2.uid          AS p2Id,
          p2.username     AS p2Username,
          p2.rating       AS p2Rating,
          r2.score        AS p2Score,
          r2.ratingBefore AS p2RatingBefore,
          r2.ratingAfter  AS p2RatingAfter,
          r2.rocks        AS p2Rocks,
          r2.papers       AS p2Papers,
          r2.scissors     AS p2Scissors`,
      { matchId },
      );

      if (matchResult.records.length === 0) return null;
      const m = matchResult.records[0];

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
          p1Id: m.get("matchP1Id"),
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
        // Numeric fields are only ever null for legacy/incomplete records; callers
        // of this function have always assumed a fully-populated completed match.
      } as MatchDetail;
    });
  } finally {
    await session.close();
  }
}
