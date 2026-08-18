import { adminDb } from "@/lib/firebaseAdmin";
import { Game } from "@/types";
import { MatchStatus } from "@/types/neo4j";
import { GAME_MODES } from "@/lib/gameModes";

export interface LiveGame {
  id: string;
  player1Id: string;
  player1Username: string;
  player2Id: string;
  player2Username: string;
  score: string;
  round: number;
}

/**
 * Server-side snapshot of currently-live games, used to seed `LiveMatches` so
 * it renders in the initial SSR HTML instead of popping in after the client
 * `onValue` listener connects (a layout-shift source on `/`).
 */
export async function getLiveGames(): Promise<LiveGame[]> {
  const snapshot = await adminDb.ref("games").get();
  const data = snapshot.val() as Record<string, Game> | null ?? {};

  return Object.values(data)
    .filter((g) => GAME_MODES[g.mode ?? "blitz"].live && g.state === MatchStatus.InProgress)
    .map((g) => ({
      id: g.id,
      player1Id: g.player1.id,
      player1Username: g.player1.username,
      player2Id: g.player2.id,
      player2Username: g.player2.username,
      score: `${g.player1.score}-${g.player2.score}`,
      round: g.currentRound,
    }));
}
