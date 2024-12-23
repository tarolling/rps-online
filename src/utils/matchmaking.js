import { getDatabase, ref, set, get, update, remove } from 'firebase/database';
import { GameStates, Choices } from '../types/gameTypes';

const db = getDatabase();

export const findMatch = async (userId, userRating) => {
    const queueRef = ref(db, 'matchmaking_queue');
    const gameRef = ref(db, 'games');

    // First check for existing suitable match
    const snapshot = await get(queueRef);
    const queue = snapshot.val() || {};

    for (const [playerId, playerData] of Object.entries(queue)) {
        if (playerId !== userId &&
            Math.abs(playerData.rating - userRating) <= 100) {

            // Create new game
            const gameId = crypto.randomUUID();
            const game = {
                id: gameId,
                state: GameStates.IN_PROGRESS,
                player1: {
                    id: playerId,
                    score: 0,
                    rating: playerData.rating
                },
                player2: {
                    id: userId,
                    score: 0,
                    rating: userRating
                },
                currentRound: 1,
                maxRounds: 7, // First to 4
                timestamp: Date.now()
            };

            // Remove matched player from queue
            await remove(ref(db, `matchmaking_queue/${playerId}`));

            // Create game
            await set(ref(db, `games/${gameId}`), game);

            return { gameId, opponent: playerData };
        }
    }

    // If no match found, add to queue
    await set(ref(db, `matchmaking_queue/${userId}`), {
        rating: userRating,
        timestamp: Date.now()
    });

    return null;
};

const resolveRound = async (gameId) => {
    const gameRef = ref(db, `games/${gameId}`);
    const game = (await get(gameRef)).val();

    const winner = determineRoundWinner(
        game.player1Choice,
        game.player2Choice
    );

    if (winner) {
        await update(gameRef, {
            [`${winner}.score`]: game[winner].score + 1
        });
    }

    // Check if game is over
    if (game[winner].score >= 4) {
        await update(gameRef, {
            state: GameStates.FINISHED,
            winner: game[winner].id
        });
        // Update ratings
        // updatePlayerRatings(game);
    } else {
        // Reset for next round
        await update(gameRef, {
            currentRound: game.currentRound + 1,
            player1Choice: null,
            player2Choice: null
        });
    }
};

const determineRoundWinner = (choice1, choice2) => {
    if (choice1 === choice2) return null;
    const wins = {
        [Choices.ROCK]: Choices.SCISSORS,
        [Choices.PAPER]: Choices.ROCK,
        [Choices.SCISSORS]: Choices.PAPER
    };
    return wins[choice1] === choice2 ? 'player1' : 'player2';
};