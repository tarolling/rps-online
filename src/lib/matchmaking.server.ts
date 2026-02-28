import { MatchStatus } from "@/types/neo4j";
import { Game } from "../types";
import { adminDb } from "./firebaseAdmin";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TournamentInfo {
    tournamentId: string;
    matchId: string;
}

/** Number of rounds a player must win to win the game. */
export const FIRST_TO = 4;

// ── Game lifecycle ────────────────────────────────────────────────────────────

/**
 * Creates a new game between two players and removes both from the matchmaking
 * queue (unless this is a tournament game, in which case the queue is untouched).
 *
 * @returns The ID of the newly created game.
 */
export async function createGame(
  playerOneId: string,
  playerOneUsername: string,
  playerOneRating: number,
  playerTwoId: string,
  playerTwoUsername: string,
  playerTwoRating: number,
  tournamentInfo: TournamentInfo | null = null,
): Promise<string> {
  const gameId = crypto.randomUUID();

  const game: Game = {
    id: gameId,
    state: MatchStatus.Waiting,
    player1: { id: playerOneId, username: playerOneUsername, score: 0, rating: playerOneRating, choice: null, submitted: false },
    player2: { id: playerTwoId, username: playerTwoUsername, score: 0, rating: playerTwoRating, choice: null, submitted: false },
    rounds: [],
    currentRound: 1,
    timestamp: Date.now(),
    ...(tournamentInfo && {
      tournamentId: tournamentInfo.tournamentId,
      matchId: tournamentInfo.matchId,
    }),
  };

  try {
    await Promise.all([
      adminDb.ref(`games/${gameId}`).set(game),
      ...(!tournamentInfo ? [
        adminDb.ref(`matchmaking_queue/${playerOneId}`).remove(),
        adminDb.ref(`matchmaking_queue/${playerTwoId}`).remove(),
      ] : []),
    ]);
    return gameId;
  } catch (error) {
    console.error("Error creating game:", error);
    throw error;
  }
}
