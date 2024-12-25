import { getDatabase, ref, set, get, update, remove, onValue, off } from 'firebase/database';
import { GameStates, Choices, GameResults } from '../types/gameTypes';


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
        rounds: [],
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

export const resolveRound = async (gameId, playerId) => {
    const gameRef = ref(db, `games/${gameId}`);

    try {
        const snapshot = await get(gameRef);
        if (!snapshot.exists()) {
            throw new Error('Game not found');
        }

        const game = snapshot.val();
        const winner = determineRoundWinner(game.player1.choice, game.player2.choice);

        const updates = {
            'player1/choice': null,
            'player2/choice': null,
            currentRound: game.currentRound + 1,
            'player1/score': game.player1.score,
            'player2/score': game.player2.score
        };

        const roundData = {
            player1Choice: game.player1.choice,
            player2Choice: game.player2.choice,
            winner
        };
        updates.rounds = [...(game.rounds || []), roundData];

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

        if (updates.state === GameStates.FINISHED) {
            await endGame(gameId, playerId);
            return { winner: updates.winner };
        }
        return null;
    } catch (error) {
        console.error('Error resolving round:', error);
        throw error;
    }
};

const determineRoundWinner = (choice1, choice2) => {
    if (choice1 === '' && choice2 === '') {
        return null;
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

export const calculateGameStats = (game, mainPlayer) => {
    const player1Choices = {
        ROCK: 0,
        PAPER: 0,
        SCISSORS: 0
    };

    const player2Choices = {
        ROCK: 0,
        PAPER: 0,
        SCISSORS: 0
    };

    game.rounds?.forEach(round => {
        if (round.player1Choice) {
            player1Choices[round.player1Choice]++;
        }
        if (round.player2Choice) {
            player2Choices[round.player2Choice]++;
        }
    });

    if (mainPlayer === 'p1') {
        return {
            playerChoices: player1Choices,
            opponentChoices: player2Choices,
            totalRounds: game.currentRound
        };
    }

    return {
        playerChoices: player2Choices,
        opponentChoices: player1Choices,
        totalRounds: game.currentRound
    };
};

export const endGame = async (gameID, playerID) => {
    const gameRef = ref(db, `games/${gameID}`);

    try {
        const snapshot = await get(gameRef);
        const game = snapshot.val();

        if (!game) {
            throw new Error("Game not found");
        }

        const mainPlayer = playerID === game.player1.id ? 'p1' : 'p2';
        const result = playerID === game.winner.id ? GameResults.WIN : GameResults.LOSS;
        const gameStats = calculateGameStats(game, mainPlayer);

        try {
            if (mainPlayer === 'p1') {
                await fetch('/api/postGameStats', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        playerID: game.player1.id,
                        opponentID: game.player2.id,
                        playerRating: game.player1.rating,
                        opponentRating: game.player2.rating,
                        playerScore: game.player1.score,
                        opponentScore: game.player2.score,
                        result,
                        gameStats
                    }),
                });
            } else {
                await fetch('/api/postGameStats', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        playerID: game.player2.id,
                        opponentId: game.player1.id,
                        playerRating: game.player2.rating,
                        opponentRating: game.player1.rating,
                        playerScore: game.player2.score,
                        opponentScore: game.player1.score,
                        result,
                        gameStats
                    }),
                });
            }
        } catch (error) {
            console.error('Error sending game stats', error);
        }

        remove(gameRef);
    } catch (error) {
        console.error('Error ending game:', error);
        throw error;
    }
};