import { getDatabase, ref, set, get, update, remove, onValue, off } from 'firebase/database';
import { GameStates, Choices } from '../types/gameTypes';


const FIRST_TO = 4;
const db = getDatabase();

export const findMatch = async (userId, userRating) => {
    const queueRef = ref(db, 'matchmaking_queue');

    try {
        const snapshot = await get(queueRef);
        const queue = snapshot.val() || {};

        for (const [playerId, playerData] of Object.entries(queue)) {
            if (playerId !== userId && Math.abs(playerData.rating - userRating) <= 100) {
                const gameId = await createGame(playerId, playerData.rating, userId, userRating);
                return { gameId, opponent: playerData };
            }
        }

        await set(ref(db, `matchmaking_queue/${userId}`), {
            rating: userRating,
            timestamp: Date.now()
        });

        return new Promise((resolve) => {
            const userQueueRef = ref(db, `matchmaking_queue/${userId}`);
            const gamesRef = ref(db, 'games');

            const unsubscribeQueue = onValue(userQueueRef, async (snapshot) => {
                if (!snapshot.exists()) {
                    const gamesSnapshot = await get(gamesRef);
                    const games = gamesSnapshot.val() || {};

                    for (const [gameId, game] of Object.entries(games)) {
                        if (game.state === GameStates.IN_PROGRESS &&
                            (game.player1.id === userId || game.player2.id === userId)) {
                            off(userQueueRef);
                            resolve({ gameId });
                            return;
                        }
                    }
                }
            });

            setTimeout(() => {
                off(userQueueRef);
                remove(ref(db, `matchmaking_queue/${userId}`));
                resolve({ error: 'Match timeout' });
            }, 60000);

            return () => {
                unsubscribeQueue();
                off(userQueueRef);
            }
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
            rating: player1Rating,
            choice: null
        },
        player2: {
            id: player2Id,
            score: 0,
            rating: player2Rating,
            choice: null
        },
        currentRound: 1,
        timestamp: Date.now()
    };

    try {
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
        const winner = determineRoundWinner(game.player1.choice, game.player2.choice);

        const updates = {
            player1Choice: null,
            player2Choice: null,
            currentRound: game.currentRound + 1,
            'player1/score': game.player1.score,
            'player2/score': game.player2.score
        };

        if (winner) {
            const winningPlayer = winner === 'player1' ? game.player1 : game.player2;
            const newScore = winningPlayer.score + 1;
            updates[`${winner}/score`] = newScore;

            if (newScore >= FIRST_TO) {
                updates.state = GameStates.FINISHED;
                updates.winner = game[winner].id;
                updates.endTimestamp = Date.now();
                updates.currentRound = game.currentRound;
            }
        }

        await update(gameRef, updates);
        return updates.state === GameStates.FINISHED ? { winner: updates.winner } : null;
    } catch (error) {
        console.error('Error resolving round:', error);
        throw error;
    }
};

const determineRoundWinner = (choice1, choice2) => {
    if (choice1 === '' && choice2 === '') {
        return null; // TODO: implement double afk
    }

    if (!choice1) return 'player2';
    if (!choice2) return 'player1';

    if (choice1 === choice2) return null;


    const wins = {
        [Choices.ROCK]: Choices.SCISSORS,
        [Choices.PAPER]: Choices.ROCK,
        [Choices.SCISSORS]: Choices.PAPER
    };

    return wins[choice1] === choice2 ? 'player1' : 'player2';
};