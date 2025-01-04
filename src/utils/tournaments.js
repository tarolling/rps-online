import { get, getDatabase, ref, set } from 'firebase/database';
import { createGame } from './matchmaking';

const db = getDatabase();

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


const seedParticipants = (participants, numPlayers) => {
    const participantArray = participants.sort((a, b) => b.rating - a.rating);

    const seedIndices = generateSeeds(numPlayers);
    const seeds = Array(seedIndices.length).fill(null);

    for (let i = 0; i < seedIndices.length; i++) {
        if (seedIndices[i] > participantArray.length) continue;
        seeds[i] = {
            ...participantArray[seedIndices[i] - 1],
            seed: seedIndices[i]
        };
    }

    return seeds;
};

const generateBracket = (seededParticipants) => {
    const bracket = [];
    const nextRoundPlayers = [];

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
        });

        nextRoundPlayers.push(!player2 ? player1 : null);
    }

    if (seededParticipants.length === 2) return bracket;

    for (let i = 0; i < nextRoundPlayers.length; i += 2) {
        const player1 = nextRoundPlayers[i];
        const player2 = nextRoundPlayers[i + 1];

        bracket.push({
            matchId: `round2_match${i / 2 + 1}`,
            round: 2,
            player1: player1,
            player2: player2,
            nextMatchId: nextRoundPlayers.length !== 2 ?
                `round3_match${Math.floor(i / 4) + 1}`
                : null,
            status: 'pending',
            winner: null,
        });
    }

    return bracket;
};


export const startTournament = async (tournamentId) => {
    try {
        const tournamentRef = ref(db, `tournaments/${tournamentId}`);
        const tournamentSnapshot = await get(tournamentRef);
        const tournament = tournamentSnapshot.val();

        if (!tournament || !tournament.participants) {
            throw new Error('Tournament not found or no participants');
        }

        const participantsArray = Object.values(tournament.participants);

        const seededParticipants = seedParticipants(participantsArray, participantsArray.length);

        const bracket = generateBracket(seededParticipants);

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

export const advanceWinner = async (tournamentId, matchId, winnerId) => {
    try {
        const tournamentRef = ref(db, `tournaments/${tournamentId}`);
        const tournamentSnapshot = await get(tournamentRef);
        const tournament = tournamentSnapshot.val();

        if (!tournament || !tournament.bracket) {
            throw new Error('Tournament or bracket not found');
        }

        const currentMatch = tournament.bracket.find(m => m.matchId === matchId);
        if (!currentMatch || currentMatch.winner) return;

        const winningPlayer = currentMatch.player1.id === winnerId ?
            currentMatch.player1 : currentMatch.player2;

        currentMatch.winner = winningPlayer;
        currentMatch.status = 'completed';

        if (currentMatch.nextMatchId) {
            const nextMatch = tournament.bracket.find(m => m.matchId === currentMatch.nextMatchId);
            if (nextMatch) {
                const matchNumber = parseInt(currentMatch.matchId.split('match')[1]);
                const isEvenMatch = matchNumber % 2 === 0;

                if (isEvenMatch) {
                    nextMatch.player2 = winningPlayer;
                } else {
                    nextMatch.player1 = winningPlayer;
                }

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

        const finalMatch = tournament.bracket.find(m => !m.nextMatchId);
        if (finalMatch && finalMatch.winner) {
            tournament.status = 'completed';
            tournament.winner = finalMatch.winner;
            tournament.endTime = Date.now();
        }

        await set(tournamentRef, tournament);

        return tournament;
    } catch (error) {
        console.error('Error advancing winner:', error);
        throw error;
    }
};

export const getCurrentMatch = (tournament, playerId) => {
    if (!tournament?.bracket || !playerId) return null;

    return tournament.bracket.find(match =>
        (match.player1?.id === playerId || match.player2?.id === playerId) &&
        match.status === 'pending'
    );
};

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