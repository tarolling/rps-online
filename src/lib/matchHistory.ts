import { getDriver } from "@/lib/neo4j";
import { MatchResult } from "@/types/neo4j";
import type { PlayMode } from "@/types";
import type { PlayerMatch } from "@/types/common";
import neo4j from "neo4j-driver";
import { GAME_MODES, PLAY_MODES, toPlayMode } from "@/lib/gameModes";

export interface MatchHistoryPage {
  matches: PlayerMatch[];
  totalCount: number;
  page: number;
  pageSize: number;
}

function formatResult(result: MatchResult): string {
  switch (result) {
  case MatchResult.Win: return "Win";
  case MatchResult.Loss: return "Loss";
  case MatchResult.WinAfk: return "Win (AFK)";
  case MatchResult.LossAfk: return "Loss (AFK)";
  case MatchResult.DrawAfk: return "Draw (AFK)";
  default: return "Loss";
  }
}

/**
 * Fetches one page of a single player's full match history, newest first,
 * plus the total match count for that filter (for page-count UI).
 */
export async function getMatchHistory(
  playerId: string,
  mode: PlayMode | null,
  page: number,
  pageSize: number,
): Promise<MatchHistoryPage> {
  const matchModes = mode ? [GAME_MODES[mode].matchMode] : PLAY_MODES.map((m) => GAME_MODES[m].matchMode);
  const skip = (page - 1) * pageSize;

  const session = getDriver().session({ database: process.env.NEO4J_DATABASE });

  try {
    return await session.executeRead(async (tx) => {
      const data = await tx.run(`
        MATCH (p:Player {uid: $playerId})-[r1:PARTICIPATED_IN]->(m:Match)<-[r2:PARTICIPATED_IN]-(opp:Player)
        WHERE m.mode IN $matchModes
        ORDER BY m.timestamp DESC
        SKIP $skip
        LIMIT $limit
        RETURN
          m.id AS id,
          m.mode AS mode,
          opp.uid AS uid,
          opp.username AS username,
          r1.result AS result,
          r1.score AS playerScore,
          r2.score AS opponentScore,
          m.timestamp AS date
      `,
      { playerId, matchModes, skip: neo4j.int(skip), limit: neo4j.int(pageSize) },
      );

      const countData = await tx.run(`
        MATCH (p:Player {uid: $playerId})-[:PARTICIPATED_IN]->(m:Match)
        WHERE m.mode IN $matchModes
        RETURN count(m) AS totalCount
      `,
      { playerId, matchModes },
      );

      const matches: PlayerMatch[] = data.records.map((record) => ({
        id: record.get("id"),
        mode: toPlayMode(record.get("mode")),
        opponentId: record.get("uid"),
        opponentUsername: record.get("username"),
        result: formatResult(record.get("result")),
        playerScore: neo4j.integer.toNumber(record.get("playerScore")),
        opponentScore: neo4j.integer.toNumber(record.get("opponentScore")),
        date: record.get("date"),
      }));

      const totalCount = neo4j.integer.toNumber(countData.records[0].get("totalCount"));

      return { matches, totalCount, page, pageSize };
    });
  } finally {
    await session.close();
  }
}
