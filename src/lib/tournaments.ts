import { get, getDatabase, push, ref, set } from "firebase/database";
import { createGame } from "./matchmaking";
import { Participant, Tournament, TournamentMatch } from "@/types";
import { TournamentMatchStatus, TournamentStatus, type TournamentPlayerCap } from "@/types/neo4j";
import { generateBracket, getCurrentMatch, seedParticipants } from "./tournamentBracket";

export { getCurrentMatch };

const db = getDatabase();

// ── Tournament lifecycle ──────────────────────────────────────────────────────

export async function createTournament(name: string, description: string, playerCap: TournamentPlayerCap, scheduledStartTime: number) {
  const newRef = push(ref(db, "tournaments"));
  await set(newRef, {
    id: crypto.randomUUID(),
    name,
    description,
    status: TournamentStatus.Registration,
    playerCap: playerCap,
    participants: {},
    createdAt: Date.now(),
    scheduledStartTime,
  });
}

/**
 * Starts a tournament: seeds participants, generates the bracket, creates
 * Firebase Realtime Database game entries for all round-1 matches, and
 * persists the updated tournament state.
 *
 * @returns The generated bracket.
 */
export async function startTournament(tournamentId: string): Promise<TournamentMatch[]> {
  try {
    const tournamentRef = ref(db, `tournaments/${tournamentId}`);
    const snapshot = await get(tournamentRef);
    const tournament: Tournament = snapshot.val();

    if (!tournament?.participants) {
      throw new Error("Tournament not found or has no participants.");
    }

    const participants = Object.values(tournament.participants);
    const seeded = seedParticipants(participants, participants.length);
    const bracket = generateBracket(seeded);

    const matchGames: Record<string, string> = {};
    await Promise.all(
      bracket
        .filter((match) => match.round === 1 && match.status !== TournamentMatchStatus.Bye)
        .map(async (match) => {
          const gameId = await createGame(
                        match.player1!.id, match.player1!.username, match.player1!.rating,
                        match.player2!.id, match.player2!.username, match.player2!.rating,
                        { tournamentId, matchId: match.matchId },
          );
          if (gameId) matchGames[match.matchId] = gameId;
        }),
    );

    await set(tournamentRef, {
      ...tournament,
      status: TournamentStatus.InProgress,
      bracket,
      matchGames,
      startTime: Date.now(),
    });

    return bracket;
  } catch (error) {
    console.error("Error starting tournament:", error);
    throw error;
  }
};

/**
 * Records a match result and advances the winner to the next match.
 * If both players are now set in the next match, creates a game for it.
 * If the final match is complete, marks the tournament as finished.
 *
 * @returns The updated tournament state.
 */
export const advanceWinner = async (
  tournamentId: string,
  matchId: string,
  winnerId: string,
): Promise<Tournament> => {
  try {
    const tournamentRef = ref(db, `tournaments/${tournamentId}`);
    const snapshot = await get(tournamentRef);
    const tournament: Tournament = snapshot.val();

    if (!tournament?.bracket) throw new Error("Tournament or bracket not found.");

    const currentMatch = tournament.bracket.find((m) => m.matchId === matchId);
    if (!currentMatch || currentMatch.winner) return tournament;

    const winner = currentMatch.player1?.id === winnerId
      ? currentMatch.player1
      : currentMatch.player2;

    currentMatch.winner = winner;
    currentMatch.status = TournamentMatchStatus.Completed;

    if (currentMatch.nextMatchId) {
      await assignToNextMatch(tournament, currentMatch, winner!, tournamentId);
    }

    const finalMatch = tournament.bracket.find((m) => !m.nextMatchId);
    if (finalMatch?.winner) {
      tournament.status = TournamentStatus.Completed;
      tournament.winner = finalMatch.winner;
      tournament.endTime = Date.now();
    }

    await set(tournamentRef, tournament);
    return tournament;
  } catch (error) {
    console.error("Error advancing winner:", error);
    throw error;
  }
};

/**
 * Places the winner into the correct slot (player1 or player2) of the next
 * match, and creates a game if both slots are now filled.
 */
async function assignToNextMatch(
  tournament: Tournament,
  currentMatch: TournamentMatch,
  winner: Participant,
  tournamentId: string,
): Promise<void> {
  const nextMatch = tournament.bracket!.find((m) => m.matchId === currentMatch.nextMatchId);
  if (!nextMatch) return;

  // Odd-numbered matches fill player1, even-numbered fill player2
  const matchNumber = parseInt(currentMatch.matchId.split("match")[1]);
  if (matchNumber % 2 === 0) {
    nextMatch.player2 = winner;
  } else {
    nextMatch.player1 = winner;
  }

  if (nextMatch.player1 && nextMatch.player2) {
    const gameId = await createGame(
      nextMatch.player1.id, nextMatch.player1.username, nextMatch.player1.rating,
      nextMatch.player2.id, nextMatch.player2.username, nextMatch.player2.rating,
      { tournamentId, matchId: nextMatch.matchId },
    );
    if (gameId) tournament.matchGames![nextMatch.matchId] = gameId;
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Fetches the game data associated with a specific tournament match.
 * Returns null if no game exists for the match yet.
 */
export const getMatchGame = async (tournamentId: string, matchId: string) => {
  try {
    const snapshot = await get(ref(db, `tournaments/${tournamentId}`));
    const tournament: Tournament = snapshot.val();

    const gameId = tournament?.matchGames?.[matchId];
    if (!gameId) return null;

    const gameSnapshot = await get(ref(db, `tournament_games/${gameId}`));
    return gameSnapshot.val();
  } catch (error) {
    console.error("Error getting match game:", error);
    throw error;
  }
};
