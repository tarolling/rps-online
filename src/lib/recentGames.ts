import { getDriver } from "@/lib/neo4j";
import { MatchResult } from "@/types/neo4j";
import type { PlayMode } from "@/types";
import neo4j, { DateTime } from "neo4j-driver";
import { GAME_MODES, PLAY_MODES, toPlayMode } from "@/lib/gameModes";

/** Shape returned by `getRecentGames(null, ...)` — matches across all players, not scoped to one. */
export interface GlobalRecentMatch {
  id: string;
  mode: PlayMode;
  player1: string;
  player2: string;
  playerOneId: string;
  playerTwoId: string;
  winner: string;
  score: string;
  timestamp: DateTime;
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
 * Fetches the most recent ranked matches, either for a specific player or
 * merged across all players. Shared by the API route and by Server Components
 * that need this data at render time (avoids a self-fetch over HTTP, which
 * breaks under Vercel Deployment Protection on preview builds).
 */
export async function getRecentGames(playerId: string | null, mode: PlayMode | null) {
  const matchModes = mode ? [GAME_MODES[mode].matchMode] : PLAY_MODES.map((m) => GAME_MODES[m].matchMode);

  const session = getDriver().session({ database: process.env.NEO4J_DATABASE });

  try {
    return await session.executeRead(async (tx) => {
      if (playerId) {
        const data = await tx.run(`
          MATCH (p:Player {uid: $playerId})-[r1:PARTICIPATED_IN]->(m:Match)<-[r2:PARTICIPATED_IN]-(opp:Player)
          WHERE m.mode IN $matchModes
          ORDER BY m.timestamp DESC
          LIMIT 3
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
        { playerId, matchModes },
        );

        return data.records.map((record) => ({
          id: record.get("id"),
          mode: toPlayMode(record.get("mode")),
          opponentId: record.get("uid"),
          opponentUsername: record.get("username"),
          result: formatResult(record.get("result")),
          playerScore: neo4j.integer.toNumber(record.get("playerScore")),
          opponentScore: neo4j.integer.toNumber(record.get("opponentScore")),
          date: record.get("date"),
        }));
      } else {
        const data = await tx.run(`
          MATCH (p1:Player)-[r1:PARTICIPATED_IN]->(m:Match)<-[r2:PARTICIPATED_IN]-(p2:Player)
          WHERE elementId(p1) < elementId(p2) AND m.mode IN $matchModes
          ORDER BY m.timestamp DESC
          LIMIT 3
          RETURN m.id AS id,
              m.mode AS mode,
              p1.uid AS playerOneId,
              p1.username AS playerOneUsername,
              p2.uid AS playerTwoId,
              p2.username AS playerTwoUsername,
              m.winnerId AS winner,
              r1.score AS playerOneScore,
              r2.score AS playerTwoScore,
              m.timestamp AS timestamp
        `, { matchModes });

        return data.records.map((record): GlobalRecentMatch => {
          const playerOneScore = neo4j.integer.toNumber(record.get("playerOneScore"));
          const playerTwoScore = neo4j.integer.toNumber(record.get("playerTwoScore"));
          const winnerId = record.get("winner");
          const winner = winnerId === null ? "Draw" : winnerId === record.get("playerOneId") ? record.get("playerOneUsername") : record.get("playerTwoUsername");
          return {
            id: record.get("id"),
            mode: toPlayMode(record.get("mode")),
            player1: record.get("playerOneUsername"),
            player2: record.get("playerTwoUsername"),
            playerOneId: record.get("playerOneId"),
            playerTwoId: record.get("playerTwoId"),
            winner: winner,
            score: `${playerOneScore}-${playerTwoScore}`,
            timestamp: record.get("timestamp"),
          };
        });
      }
    });
  } finally {
    await session.close();
  }
}
