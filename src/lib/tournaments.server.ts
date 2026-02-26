import { Tournament, Participant, Match, PlayerCap } from '../types/tournament';
import { adminDb } from './firebaseAdmin';
import { createGame } from './matchmaking.server';


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
function seedParticipants(participants: Participant[], numPlayers: number): (Participant | null)[] {
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
function generateBracket(seededParticipants: (Participant | null)[]): Match[] {
    const bracket: Match[] = [];
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
            status: isBye ? 'bye' : 'pending',
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
            status: 'pending',
            winner: null,
        });
    }

    return bracket;
}

// ── Tournament lifecycle ──────────────────────────────────────────────────────

/**
 * Creates a new tournament.
 * @param name 
 * @param description 
 * @param playerCap 
 * @param scheduledStartTime 
 */
export async function createTournament(name: string, description: string, playerCap: PlayerCap, scheduledStartTime: number) {
    const newRef = adminDb.ref('tournaments').push();
    await newRef.set({
        id: crypto.randomUUID(),
        name,
        description,
        status: 'registration',
        playerCap: playerCap,
        participants: {},
        createdAt: Date.now(),
        scheduledStartTime
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
    const snapshot = await adminDb.ref('tournaments').get();
    const tournaments: Record<string, Tournament> = snapshot.val() ?? {};
    const now = Date.now();

    const toStart = Object.entries(tournaments).filter(([, t]) =>
        t.status === 'registration' &&
        t.scheduledStartTime <= now &&
        Object.keys(t.participants ?? {}).length >= 2
    );

    await Promise.all(toStart.map(([id]) => startTournament(id)));
}

/**
 * Deleted any tournaments that were scheduled to start but didn't have sufficient players
 */
export async function clearExpiredTournaments() {
    const snapshot = await adminDb.ref('tournaments').get();
    const tournaments: Record<string, Tournament> = snapshot.val() ?? {};
    const now = Date.now();

    const toStart = Object.entries(tournaments).filter(([, t]) =>
        t.status === 'registration' &&
        t.scheduledStartTime <= now &&
        Object.keys(t.participants ?? {}).length < 2
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
export async function startTournament(tournamentId: string): Promise<Match[]> {
    try {
        const tournamentRef = adminDb.ref(`tournaments/${tournamentId}`);
        const snapshot = await tournamentRef.get();
        const tournament: Tournament = snapshot.val();

        if (!tournament?.participants) {
            throw new Error('Tournament not found or has no participants.');
        }

        const participants = Object.values(tournament.participants);
        const seeded = seedParticipants(participants, participants.length);
        const bracket = generateBracket(seeded);

        const matchGames: Record<string, string> = {};
        await Promise.all(
            bracket
                .filter((match) => match.round === 1 && match.status !== 'bye')
                .map(async (match) => {
                    const gameId = await createGame(
                        match.player1!.id, match.player1!.username, match.player1!.rating,
                        match.player2!.id, match.player2!.username, match.player2!.rating,
                        { tournamentId, matchId: match.matchId }
                    );
                    if (gameId) matchGames[match.matchId] = gameId;
                })
        );

        await tournamentRef.set({
            ...tournament,
            status: 'in_progress',
            bracket,
            matchGames,
            startTime: Date.now(),
        });

        return bracket;
    } catch (error) {
        console.error('Error starting tournament:', error);
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
    winnerId: string
): Promise<Tournament> {
    try {
        const tournamentRef = adminDb.ref(`tournaments/${tournamentId}`);
        const snapshot = await tournamentRef.get();
        const tournament: Tournament = snapshot.val();

        if (!tournament?.bracket) throw new Error('Tournament or bracket not found.');

        const currentMatch = tournament.bracket.find((m) => m.matchId === matchId);
        if (!currentMatch || currentMatch.winner) return tournament;

        const winner = currentMatch.player1?.id === winnerId
            ? currentMatch.player1
            : currentMatch.player2;

        currentMatch.winner = winner;
        currentMatch.status = 'completed';

        if (currentMatch.nextMatchId) {
            await assignToNextMatch(tournament, currentMatch, winner!, tournamentId);
        }

        const finalMatch = tournament.bracket.find((m) => !m.nextMatchId);
        if (finalMatch?.winner) {
            tournament.status = 'completed';
            tournament.winner = finalMatch.winner;
            tournament.endTime = Date.now();
        }

        await tournamentRef.set(tournament);
        return tournament;
    } catch (error) {
        console.error('Error advancing winner:', error);
        throw error;
    }
};

/**
 * Places the winner into the correct slot (player1 or player2) of the next
 * match, and creates a game if both slots are now filled.
 */
async function assignToNextMatch(
    tournament: Tournament,
    currentMatch: Match,
    winner: Participant,
    tournamentId: string,
): Promise<void> {
    const nextMatch = tournament.bracket!.find((m) => m.matchId === currentMatch.nextMatchId);
    if (!nextMatch) return;

    // Odd-numbered matches fill player1, even-numbered fill player2
    const matchNumber = parseInt(currentMatch.matchId.split('match')[1]);
    if (matchNumber % 2 === 0) {
        nextMatch.player2 = winner;
    } else {
        nextMatch.player1 = winner;
    }

    if (nextMatch.player1 && nextMatch.player2) {
        const gameId = await createGame(
            nextMatch.player1.id, nextMatch.player1.username, nextMatch.player1.rating,
            nextMatch.player2.id, nextMatch.player2.username, nextMatch.player2.rating,
            { tournamentId, matchId: nextMatch.matchId }
        );
        if (gameId) tournament.matchGames![nextMatch.matchId] = gameId;
    }
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Returns the current pending match for a player in a tournament, or null
 * if the player has no active match.
 */
export function getCurrentMatch(tournament: Tournament | null, playerId: string): Match | null {
    if (!tournament?.bracket || !playerId) return null;
    return tournament.bracket.find(
        (match) =>
            (match.player1?.id === playerId || match.player2?.id === playerId) &&
            match.status === 'pending'
    ) ?? null;
};

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
        console.error('Error getting match game:', error);
        throw error;
    }
};
