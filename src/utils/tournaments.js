import { get, getDatabase, ref, set, push } from 'firebase/database';

const db = getDatabase();

// Calculate number of rounds needed and round up to next power of 2
const getNextPowerOfTwo = (n) => {
    return Math.pow(2, Math.ceil(Math.log2(n)));
};

// Generate empty slots up to the next power of 2
const generateEmptySlots = (participants, totalSlots) => {
    const slots = [...participants];
    while (slots.length < totalSlots) {
        slots.push(null);
    }
    return slots;
};

// Seed participants using standard tournament seeding pattern
const seedParticipants = (participants, totalSlots) => {
    const seeds = Array(totalSlots).fill(null);
    const participantArray = participants.sort((a, b) => b.skillRating - a.skillRating);

    // Standard tournament seeding pattern
    for (let i = 0; i < participantArray.length; i++) {
        let seed = i + 1;
        let position;

        // Calculate position using standard bracket seeding
        if (seed === 1) position = 0;
        else if (seed === 2) position = totalSlots - 1;
        else {
            // For other seeds, use standard bracket placement
            let power = Math.floor(Math.log2(seed - 1));
            let subGroup = seed - Math.pow(2, power);
            let groupSize = Math.pow(2, power + 1);
            position = (subGroup * 2 + 1) * (totalSlots / groupSize);
        }

        seeds[position] = participantArray[i];
    }

    return seeds;
};

// Generate all matches for the tournament
const generateBracket = (seededParticipants) => {
    const rounds = Math.log2(seededParticipants.length);
    const bracket = [];

    // Generate first round matches
    for (let i = 0; i < seededParticipants.length; i += 2) {
        const player1 = seededParticipants[i];
        const player2 = seededParticipants[i + 1];

        bracket.push({
            matchId: `round1_match${i / 2 + 1}`,
            round: 1,
            player1: player1,
            player2: player2,
            nextMatchId: `round2_match${Math.floor(i / 4) + 1}`,
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

// Create a game for a match
const createGame = async (tournamentId, match) => {
    if (!match.player1 || !match.player2 || match.status === 'bye') return null;

    const gameRef = push(ref(db, 'tournament_games'));
    const gameData = {
        tournamentId,
        matchId: match.matchId,
        player1: {
            id: match.player1.id,
            username: match.player1.username,
            score: 0
        },
        player2: {
            id: match.player2.id,
            username: match.player2.username,
            score: 0
        },
        status: 'pending',
        createdAt: Date.now()
    };

    await set(gameRef, gameData);
    return gameRef.key;
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

        // Calculate total slots needed (next power of 2)
        const totalSlots = getNextPowerOfTwo(participantsArray.length);

        // Seed participants
        const seededParticipants = seedParticipants(participantsArray, totalSlots);

        // Generate bracket
        const bracket = generateBracket(seededParticipants);

        // Create games for first round matches
        const matchGames = {};
        for (const match of bracket) {
            if (match.round === 1 && match.status !== 'bye') {
                const gameId = await createGame(tournamentId, match);
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
                    const gameId = await createGame(tournamentId, nextMatch);
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