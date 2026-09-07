import { Tournament, TournamentMatch } from "@/types";
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
 * Guarded by an RTDB transaction that claims the tournament (via a
 * `starting` flag) before doing any of the async bracket/game-creation work,
 * so a concurrent cron invocation racing against this one can't also pass
 * the Registration check and generate a second, duplicate bracket.
 *
 * @returns The generated bracket, or `null` if the tournament was already
 * claimed/started by another call.
 */
export async function startTournament(tournamentId: string): Promise<TournamentMatch[] | null> {
  const tournamentRef = adminDb.ref(`tournaments/${tournamentId}`);

  const claim = await tournamentRef.transaction((current: Tournament | null) => {
    // `current` starts out as an optimistic `null` guess on the first
    // invocation (no active listener keeps a local cache warm for this ref
    // server-side) — returning it unchanged lets the transaction retry
    // against the real server value instead of treating the guess as proof
    // the tournament doesn't exist.
    if (!current) return current;
    if (current.status !== TournamentStatus.Registration || current.starting) {
      return; // abort, no write — already claimed/started
    }
    return { ...current, starting: true };
  });

  if (!claim.committed) return null;
  const tournament: Tournament = claim.snapshot.val();

  try {
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

    const finalTournament: Tournament = {
      ...tournament,
      status: TournamentStatus.InProgress,
      bracket,
      matchGames,
      startTime: Date.now(),
    };
    delete finalTournament.starting;
    await tournamentRef.set(finalTournament);

    return bracket;
  } catch (error) {
    console.error("Error starting tournament:", error);
    // Release the claim so a future sweep can retry instead of leaving the
    // tournament stuck in Registration with `starting: true` forever.
    await tournamentRef.child("starting").remove().catch(() => {});
    throw error;
  }
};

/**
 * Records a match result and advances the winner to the next match.
 * If both players are now set in the next match, creates a game for it.
 * If the final match is complete, marks the tournament as finished.
 *
 * Runs as an RTDB transaction because two matches in the same round can
 * complete around the same time: a plain get()+set() would let a second call
 * overwrite the whole tournament document with a stale bracket, silently
 * dropping the first call's winner assignment. `nextGameMatchId` is only set
 * on the transaction attempt that actually fills the next match's slots, so
 * `createGame` below (a side effect that must not run inside the retryable
 * transaction callback) only fires once.
 *
 * @returns The updated tournament state.
 */
export async function advanceWinner(
  tournamentId: string,
  matchId: string,
  winnerId: string,
): Promise<Tournament> {
  const tournamentRef = adminDb.ref(`tournaments/${tournamentId}`);
  let failure: string | null = null;
  let nextGameMatchId: string | undefined;

  try {
    const txResult = await tournamentRef.transaction((current: Tournament | null) => {
      failure = null;
      nextGameMatchId = undefined;

      // `current` starts out as an optimistic `null` guess on the first
      // invocation — return it unchanged so the transaction retries against
      // the real server value instead of aborting on an unconfirmed guess.
      if (!current) return current;
      if (!current.bracket) {
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
      }

      return current;
    });

    if (failure) throw new Error(failure);

    const tournament: Tournament = txResult.snapshot.val();
    if (!tournament) throw new Error("Tournament or bracket not found.");

    if (nextGameMatchId) {
      const nextMatch = tournament.bracket!.find((m) => m.matchId === nextGameMatchId);
      if (nextMatch?.player1 && nextMatch?.player2) {
        const gameId = await createGame(
          nextMatch.player1.id, nextMatch.player1.username, nextMatch.player1.rating,
          nextMatch.player2.id, nextMatch.player2.username, nextMatch.player2.rating,
          { tournamentId, matchId: nextMatch.matchId },
        );
        if (gameId) {
          await tournamentRef.child(`matchGames/${nextMatch.matchId}`).set(gameId);
          tournament.matchGames = { ...tournament.matchGames, [nextMatch.matchId]: gameId };
        }
      }
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
