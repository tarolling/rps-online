import { Participant, Tournament, TournamentMatch } from "@/types";
import { adminDb } from "./firebaseAdmin";
import { createGame } from "./matchmaking.server";
import { TournamentMatchStatus, TournamentStatus, type TournamentPlayerCap } from "@/types/neo4j";
import { generateBracket, getCurrentMatch, seedParticipants } from "./tournamentBracket";

export { getCurrentMatch };

// ── Tournament lifecycle ──────────────────────────────────────────────────────

/**
 * Creates a new tournament.
 * @param name 
 * @param description 
 * @param playerCap 
 * @param scheduledStartTime 
 */
export async function createTournament(name: string, description: string, playerCap: TournamentPlayerCap, scheduledStartTime: number) {
  const newRef = adminDb.ref("tournaments").push();
  await newRef.set({
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
 * Deletes a tournament.
 * @param id The tournament's Firebase ID
 */
export async function deleteTournament(id: string) {
  await adminDb.ref(`tournaments/${id}`).remove();
}

export async function startScheduledTournaments() {
  const snapshot = await adminDb.ref("tournaments").get();
  const tournaments: Record<string, Tournament> = snapshot.val() ?? {};
  const now = Date.now();

  const toStart = Object.entries(tournaments).filter(([, t]) =>
    t.status === TournamentStatus.Registration &&
        t.scheduledStartTime <= now &&
        Object.keys(t.participants ?? {}).length >= 2,
  );

  await Promise.all(toStart.map(([id]) => startTournament(id)));
}

/**
 * Deleted any tournaments that were scheduled to start but didn't have sufficient players
 */
export async function clearExpiredTournaments() {
  const snapshot = await adminDb.ref("tournaments").get();
  const tournaments: Record<string, Tournament> = snapshot.val() ?? {};
  const now = Date.now();

  const toStart = Object.entries(tournaments).filter(([, t]) =>
    t.status === TournamentStatus.Registration &&
        t.scheduledStartTime <= now &&
        Object.keys(t.participants ?? {}).length < 2,
  );

  await Promise.all(toStart.map(([id]) => deleteTournament(id)));
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
    const tournamentRef = adminDb.ref(`tournaments/${tournamentId}`);
    const snapshot = await tournamentRef.get();
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

    await tournamentRef.set({
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
export async function advanceWinner(
  tournamentId: string,
  matchId: string,
  winnerId: string,
): Promise<Tournament> {
  try {
    const tournamentRef = adminDb.ref(`tournaments/${tournamentId}`);
    const snapshot = await tournamentRef.get();
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

    await tournamentRef.set(tournament);
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
export async function getMatchGame(tournamentId: string, matchId: string) {
  try {
    const snapshot = await adminDb.ref(`tournaments/${tournamentId}`).get();
    const tournament: Tournament = snapshot.val();

    const gameId = tournament?.matchGames?.[matchId];
    if (!gameId) return null;

    const gameSnapshot = await adminDb.ref(`tournament_games/${gameId}`).get();
    return gameSnapshot.val();
  } catch (error) {
    console.error("Error getting match game:", error);
    throw error;
  }
};
