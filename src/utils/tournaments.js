import { get, getDatabase, ref, set, push } from 'firebase/database';
import { createGame } from './matchmaking';

const db = getDatabase();

// Calculate number of rounds needed and round up to next power of 2
const getNextPowerOfTwo = (n) => {
    return Math.pow(2, Math.ceil(Math.log2(n)));
};

const generateSeeds = (numPlayers) => {
    const rounds = Math.log(numPlayers) / Math.log(2) - 1;
    let pls = [1, 2];
    for (let i = 0; i < rounds; i++) {
        pls = nextLayer(pls);
    }
    return pls;

    function nextLayer(pls) {
        const out = [];
        const length = pls.length * 2 + 1;
        pls.forEach((d) => {
            out.push(d);
            out.push(length - d);
        });
        return out;
    }
}


// Seed participants using standard tournament seeding pattern
const seedParticipants = (participants, numPlayers) => {
    const participantArray = participants.sort((a, b) => b.rating - a.rating);

    const seedIndices = generateSeeds(numPlayers).map(num => num - 1);
    const seeds = Array(seedIndices.length).fill(null);

    for (let i = 0; i < seedIndices.length; i++) {
        if (seedIndices[i] >= participantArray.length) continue;
        seeds[i] = participantArray[seedIndices[i]];
    }

    return seeds;
};

// Generate all matches for the tournament
const generateBracket = (seededParticipants) => {
    const rounds = Math.log2(seededParticipants.length);
    const bracket = [];

    for (const part of seededParticipants) {
        console.log("seeded participant:", part);
    }

    // Generate first round matches
    for (let i = 0; i < seededParticipants.length; i += 2) {
        const player1 = seededParticipants[i];
        const player2 = seededParticipants[i + 1];

        bracket.push({
            matchId: `round1_match${i / 2 + 1}`,
            round: 1,
            player1: player1,
            player2: player2,
            nextMatchId: seededParticipants.length !== 2 ?
                `round2_match${Math.floor(i / 4) + 1}`
                : null,
            status: player2 === null ? 'bye' : 'pending',
            winner: player2 === null ? player1 : null,
            seed1: i + 1,
            seed2: i + 2
        });
    }

    // Generate placeholder matches for subsequent rounds
    for (let round = 2; round <= rounds; round++) {
        const matchesInRound = seededParticipants.length / Math.pow(2, round);
        for (let i = 0; i < matchesInRound; i++) {
            bracket.push({
                matchId: `round${round}_match${i + 1}`,
                round: round,
                player1: null,
                player2: null,
                nextMatchId: round < rounds ? `round${round + 1}_match${Math.floor(i / 2) + 1}` : null,
                status: 'pending',
                winner: null
            });
        }
    }

    return bracket;
};


// Start the tournament and create the bracket
export const startTournament = async (tournamentId) => {
    try {
        // Get tournament data
        const tournamentRef = ref(db, `tournaments/${tournamentId}`);
        const tournamentSnapshot = await get(tournamentRef);
        const tournament = tournamentSnapshot.val();

        if (!tournament || !tournament.participants) {
            throw new Error('Tournament not found or no participants');
        }

        // Convert participants object to array
        const participantsArray = Object.values(tournament.participants);

        // Seed participants
        const seededParticipants = seedParticipants(participantsArray, participantsArray.length);

        // Generate bracket
        const bracket = generateBracket(seededParticipants);

        for (const match of bracket) {
            console.log('match generated:', JSON.stringify(match));
        }

        // Create games for first round matches
        const matchGames = {};
        for (const match of bracket) {
            if (match.round === 1 && match.status !== 'bye') {
                const gameId = await createGame(
                    match.player1.id,
                    match.player1.username,
                    match.player1.rating,
                    match.player2.id,
                    match.player2.username,
                    match.player2.rating,
                    {
                        tournamentId: tournamentId,
                        matchId: match.matchId
                    }
                );
                if (gameId) {
                    matchGames[match.matchId] = gameId;
                }
            }
        }

        // Update tournament with bracket and game references
        await set(ref(db, `tournaments/${tournamentId}`), {
            ...tournament,
            status: 'in_progress',
            bracket,
            matchGames,
            startTime: Date.now()
        });

        return bracket;
    } catch (error) {
        console.error('Error starting tournament:', error);
        throw error;
    }
};

// Advance winner to next round
export const advanceWinner = async (tournamentId, matchId, winnerId) => {
    try {
        const tournamentRef = ref(db, `tournaments/${tournamentId}`);
        const tournamentSnapshot = await get(tournamentRef);
        const tournament = tournamentSnapshot.val();

        if (!tournament || !tournament.bracket) {
            throw new Error('Tournament or bracket not found');
        }

        // Find current match and update winner
        const currentMatch = tournament.bracket.find(m => m.matchId === matchId);
        if (!currentMatch || currentMatch.winner) return; // Match already has winner

        const winningPlayer = currentMatch.player1.id === winnerId ?
            currentMatch.player1 : currentMatch.player2;

        // Update current match
        currentMatch.winner = winningPlayer;
        currentMatch.status = 'completed';

        // Find next match and update player
        if (currentMatch.nextMatchId) {
            const nextMatch = tournament.bracket.find(m => m.matchId === currentMatch.nextMatchId);
            if (nextMatch) {
                // Determine if winner goes to player1 or player2 slot
                const matchNumber = parseInt(currentMatch.matchId.split('match')[1]);
                const isEvenMatch = matchNumber % 2 === 0;

                if (isEvenMatch) {
                    nextMatch.player2 = winningPlayer;
                } else {
                    nextMatch.player1 = winningPlayer;
                }

                // If both players are set, create the next game
                if (nextMatch.player1 && nextMatch.player2) {
                    const gameId = await createGame(
                        nextMatch.player1.id,
                        nextMatch.player1.username,
                        nextMatch.player1.rating,
                        nextMatch.player2.id,
                        nextMatch.player2.username,
                        nextMatch.player2.rating,
                        {
                            tournamentId: tournamentId,
                            matchId: nextMatch.matchId
                        }
                    );
                    if (gameId) {
                        tournament.matchGames[nextMatch.matchId] = gameId;
                    }
                }
            }
        }

        // Check if tournament is complete (final match has a winner)
        const finalMatch = tournament.bracket.find(m => !m.nextMatchId);
        if (finalMatch && finalMatch.winner) {
            tournament.status = 'completed';
            tournament.winner = finalMatch.winner;
            tournament.endTime = Date.now();
        }

        // Update tournament
        await set(tournamentRef, tournament);

        return tournament;
    } catch (error) {
        console.error('Error advancing winner:', error);
        throw error;
    }
};

// Get current match for a player
export const getCurrentMatch = (tournament, playerId) => {
    if (!tournament?.bracket || !playerId) return null;

    return tournament.bracket.find(match =>
        (match.player1?.id === playerId || match.player2?.id === playerId) &&
        match.status === 'pending'
    );
};

// Get game details for a match
export const getMatchGame = async (tournamentId, matchId) => {
    try {
        const tournamentRef = ref(db, `tournaments/${tournamentId}`);
        const tournamentSnapshot = await get(tournamentRef);
        const tournament = tournamentSnapshot.val();

        if (!tournament?.matchGames?.[matchId]) return null;

        const gameRef = ref(db, `tournament_games/${tournament.matchGames[matchId]}`);
        const gameSnapshot = await get(gameRef);
        return gameSnapshot.val();
    } catch (error) {
        console.error('Error getting match game:', error);
        throw error;
    }
};