import { getDatabase, ref, set, get, update, remove, onValue, off } from 'firebase/database';
import { GameStates, Choices } from '../types/gameTypes';

const db = getDatabase();

export const findMatch = async (userId, userRating) => {
    const queueRef = ref(db, 'matchmaking_queue');

    try {
        // First check for existing suitable match
        const snapshot = await get(queueRef);
        const queue = snapshot.val() || {};

        for (const [playerId, playerData] of Object.entries(queue)) {
            if (playerId !== userId && Math.abs(playerData.rating - userRating) <= 100) {
                const gameId = await createGame(playerId, playerData.rating, userId, userRating);
                return { gameId, opponent: playerData };
            }
        }

        // If no match found, add to queue and wait for match
        await set(ref(db, `matchmaking_queue/${userId}`), {
            rating: userRating,
            timestamp: Date.now()
        });

        // Set up listener for when someone matches with this player
        return new Promise((resolve) => {
            const userQueueRef = ref(db, `matchmaking_queue/${userId}`);
            const gamesRef = ref(db, 'games');

            const unsubscribeQueue = onValue(userQueueRef, async (snapshot) => {
                // If player is removed from queue, check if they're in a game
                if (!snapshot.exists()) {
                    const gamesSnapshot = await get(gamesRef);
                    const games = gamesSnapshot.val() || {};

                    for (const [gameId, game] of Object.entries(games)) {
                        if (game.state === GameStates.IN_PROGRESS &&
                            (game.player1.id === userId || game.player2.id === userId)) {
                            // Cleanup listeners
                            off(userQueueRef);
                            resolve({ gameId });
                            return;
                        }
                    }
                }
            });

            // Cleanup listener if component unmounts
            return () => off(userQueueRef);
        });
    } catch (error) {
        console.error('Error in findMatch:', error);
        throw error;
    }
};

const createGame = async (player1Id, player1Rating, player2Id, player2Rating) => {
    const gameId = crypto.randomUUID();
    const gameRef = ref(db, `games/${gameId}`);

    const game = {
        id: gameId,
        state: GameStates.IN_PROGRESS,
        player1: {
            id: player1Id,
            score: 0,
            rating: player1Rating
        },
        player2: {
            id: player2Id,
            score: 0,
            rating: player2Rating
        },
        currentRound: 1,
        maxRounds: 7,
        timestamp: Date.now()
    };

    try {
        // Execute these operations in parallel
        await Promise.all([
            set(gameRef, game),
            remove(ref(db, `matchmaking_queue/${player1Id}`)),
            remove(ref(db, `matchmaking_queue/${player2Id}`))
        ]);

        return gameId;
    } catch (error) {
        console.error('Error creating game:', error);
        throw error;
    }
};

export const resolveRound = async (gameId) => {
    const gameRef = ref(db, `games/${gameId}`);

    try {
        const snapshot = await get(gameRef);
        if (!snapshot.exists()) {
            throw new Error('Game not found');
        }

        const game = snapshot.val();
        const winner = determineRoundWinner(game.player1Choice, game.player2Choice);

        const updates = {};

        if (winner) {
            const newScore = game[winner].score + 1;
            updates[`${winner}.score`] = newScore;

            // Check if game is over
            if (newScore >= 4) {
                updates.state = GameStates.FINISHED;
                updates.winner = game[winner].id;
                updates.endTimestamp = Date.now();
            }
        }

        // Always update round if game isn't finished
        if (!updates.state) {
            updates.currentRound = game.currentRound + 1;
            updates.player1Choice = null;
            updates.player2Choice = null;
        }

        await update(gameRef, updates);

        return updates.state === GameStates.FINISHED ? { winner: updates.winner } : null;
    } catch (error) {
        console.error('Error resolving round:', error);
        throw error;
    }
};

const determineRoundWinner = (choice1, choice2) => {
    if (!choice1 || !choice2 || choice1 === choice2) return null;

    const wins = {
        [Choices.ROCK]: Choices.SCISSORS,
        [Choices.PAPER]: Choices.ROCK,
        [Choices.SCISSORS]: Choices.PAPER
    };

    return wins[choice1] === choice2 ? 'player1' : 'player2';
};