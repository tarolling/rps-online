import { get, getDatabase, ref, runTransaction, set } from "firebase/database";
import { createGame } from "./matchmaking";
import { postJSON } from "./api";
import { Tournament, TournamentMatch } from "@/types";
import { TournamentMatchStatus, TournamentStatus } from "@/types/neo4j";
import { generateBracket, getCurrentMatch, seedParticipants } from "./tournamentBracket";

export { getCurrentMatch };

const db = getDatabase();

// ── Tournament lifecycle ──────────────────────────────────────────────────────

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
 * Runs as an RTDB transaction because two matches in the same round can
 * complete around the same time (each in its own game, possibly resolved by
 * either player's client): a plain get()+set() would let a second call
 * overwrite the whole tournament document with a stale bracket, silently
 * dropping the first call's winner assignment. `nextGameMatchId` and
 * `shouldAwardChampion` are only set on the transaction attempt that actually
 * makes that change, so the network side effects below (creating the next
 * match's game, awarding the champion title) only fire once.
 *
 * @returns The updated tournament state.
 */
export const advanceWinner = async (
  tournamentId: string,
  matchId: string,
  winnerId: string,
): Promise<Tournament> => {
  const tournamentRef = ref(db, `tournaments/${tournamentId}`);
  let failure: string | null = null;
  let nextGameMatchId: string | undefined;
  let shouldAwardChampion = false;

  try {
    const txResult = await runTransaction(tournamentRef, (current: Tournament | null) => {
      failure = null;
      nextGameMatchId = undefined;
      shouldAwardChampion = false;

      if (!current?.bracket) {
        failure = "Tournament or bracket not found.";
        return; // abort, no write
      }

      const currentMatch = current.bracket.find((m) => m.matchId === matchId);
      if (!currentMatch || currentMatch.winner) return current; // already advanced, idempotent no-op

      const winner = currentMatch.player1?.id === winnerId
        ? currentMatch.player1
        : currentMatch.player2;

      currentMatch.winner = winner;
      currentMatch.status = TournamentMatchStatus.Completed;

      if (currentMatch.nextMatchId) {
        const nextMatch = current.bracket.find((m) => m.matchId === currentMatch.nextMatchId);
        if (nextMatch) {
          // Odd-numbered matches fill player1, even-numbered fill player2
          const matchNumber = parseInt(currentMatch.matchId.split("match")[1]);
          if (matchNumber % 2 === 0) {
            nextMatch.player2 = winner;
          } else {
            nextMatch.player1 = winner;
          }
          if (nextMatch.player1 && nextMatch.player2 && !current.matchGames?.[nextMatch.matchId]) {
            nextGameMatchId = nextMatch.matchId;
          }
        }
      }

      const finalMatch = current.bracket.find((m) => !m.nextMatchId);
      if (finalMatch?.winner && current.status !== TournamentStatus.Completed) {
        current.status = TournamentStatus.Completed;
        current.winner = finalMatch.winner;
        current.endTime = Date.now();
        shouldAwardChampion = true;
      }

      return current;
    });

    if (failure) throw new Error(failure);

    const tournament: Tournament = txResult.snapshot.val();

    if (nextGameMatchId) {
      const nextMatch = tournament.bracket!.find((m) => m.matchId === nextGameMatchId);
      if (nextMatch?.player1 && nextMatch?.player2) {
        const gameId = await createGame(
          nextMatch.player1.id, nextMatch.player1.username, nextMatch.player1.rating,
          nextMatch.player2.id, nextMatch.player2.username, nextMatch.player2.rating,
          { tournamentId, matchId: nextMatch.matchId },
        );
        if (gameId) {
          await set(ref(db, `tournaments/${tournamentId}/matchGames/${nextMatch.matchId}`), gameId);
          tournament.matchGames = { ...tournament.matchGames, [nextMatch.matchId]: gameId };
        }
      }
    }

    if (shouldAwardChampion) {
      // Best-effort — a title-award failure shouldn't block bracket advancement.
      postJSON("/api/tournaments/awardChampion", { tournamentId }).catch((err) =>
        console.error("Error awarding tournament champion title:", err),
      );
    }

    return tournament;
  } catch (error) {
    console.error("Error advancing winner:", error);
    throw error;
  }
};

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
