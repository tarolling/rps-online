import { Participant, Tournament, TournamentMatch } from "@/types";
import { TournamentMatchStatus } from "@/types/neo4j";

/**
 * Pure bracket-seeding/generation logic shared by the client-driven path
 * (`tournaments.ts`) and the server-driven path (`tournaments.server.ts`).
 * Contains no I/O and no Firebase SDK of any kind, so it's safely importable
 * from both "use client" pages and server-only API routes — see `gameLogic.ts`
 * for the equivalent split on the game-round side.
 */

// ── Seeding ───────────────────────────────────────────────────────────────────

/**
 * Generates a seeded bracket order for `numPlayers` participants.
 * Ensures top seeds are placed on opposite sides of the bracket.
 */
function generateSeeds(numPlayers: number): number[] {
  const rounds = Math.log2(numPlayers) - 1;
  let seeds = [1, 2];
  for (let i = 0; i < rounds; i++) {
    seeds = expandSeedLayer(seeds);
  }
  return seeds;
}

function expandSeedLayer(seeds: number[]): number[] {
  const out: number[] = [];
  const length = seeds.length * 2 + 1;
  for (const seed of seeds) {
    out.push(seed, length - seed);
  }
  return out;
}

/**
 * Sorts participants by rating (descending) and assigns them to seeded
 * bracket positions, leaving empty slots as `null` for byes.
 */
export function seedParticipants(participants: Participant[], numPlayers: number): (Participant | null)[] {
  const sorted = [...participants].sort((a, b) => b.rating - a.rating);
  const seedIndices = generateSeeds(numPlayers);

  return seedIndices.map((seedIndex) => {
    const participant = sorted[seedIndex - 1];
    if (!participant) return null;
    return { ...participant, seed: seedIndex };
  });
}

// ── Bracket generation ────────────────────────────────────────────────────────

/**
 * Generates the full bracket structure from a seeded participants list.
 * Handles byes for any slots without an opponent.
 * Currently supports up to a 2-round bracket (4–8 players); extend as needed.
 */
export function generateBracket(seededParticipants: (Participant | null)[]): TournamentMatch[] {
  const bracket: TournamentMatch[] = [];
  const byeAdvancers: (Participant | null)[] = [];
  const totalFirstRoundMatches = seededParticipants.length / 2;

  for (let i = 0; i < seededParticipants.length; i += 2) {
    const player1 = seededParticipants[i];
    const player2 = seededParticipants[i + 1];
    const isBye = player2 === null;
    const matchIndex = i / 2;

    bracket.push({
      matchId: `round1_match${matchIndex + 1}`,
      round: 1,
      player1,
      player2,
      nextMatchId: totalFirstRoundMatches > 1
        ? `round2_match${Math.floor(matchIndex / 2) + 1}`
        : null,
      status: isBye ? TournamentMatchStatus.Bye : TournamentMatchStatus.Waiting,
      winner: isBye ? player1 : null,
    });

    byeAdvancers.push(isBye ? player1 : null);
  }

  if (seededParticipants.length === 2) return bracket;

  for (let i = 0; i < byeAdvancers.length; i += 2) {
    bracket.push({
      matchId: `round2_match${i / 2 + 1}`,
      round: 2,
      player1: byeAdvancers[i],
      player2: byeAdvancers[i + 1],
      nextMatchId: byeAdvancers.length > 2
        ? `round3_match${Math.floor(i / 4) + 1}`
        : null,
      status: TournamentMatchStatus.Waiting,
      winner: null,
    });
  }

  return bracket;
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Returns the current pending match for a player in a tournament, or null
 * if the player has no active match.
 */
export function getCurrentMatch(tournament: Tournament | null, playerId: string): TournamentMatch | null {
  if (!tournament?.bracket || !playerId) return null;
  return tournament.bracket.find(
    (match) =>
      (match.player1?.id === playerId || match.player2?.id === playerId) &&
      match.status === TournamentMatchStatus.Waiting,
  ) ?? null;
}
