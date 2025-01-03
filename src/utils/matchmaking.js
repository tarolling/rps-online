import { getDatabase, ref, set, get, update, remove, onValue, off } from 'firebase/database';
import { GameStates, Choices, GameResults } from '../types/gameTypes';
import calculateRating from '../utils/calculateRating';
import { advanceWinner } from './tournaments';


export const FIRST_TO = 4;
const db = getDatabase();

const checkExistingGame = async (uid) => {
    const gamesRef = ref(db, 'games');
    const snapshot = await get(gamesRef);
    const games = snapshot.val() || {};

    for (const game of Object.values(games)) {
        if (game.state === GameStates.IN_PROGRESS &&
            (game.player1.id === uid || game.player2.id === uid)) {
            return game.id;
        }
    }
    return null;
};

export const findMatch = async (uid, username, userRating) => {
    const queueRef = ref(db, 'matchmaking_queue');

    try {
        const existingGameID = await checkExistingGame(uid);
        if (existingGameID) {
            return { gameID: existingGameID };
        }

        const snapshot = await get(queueRef);
        const queue = snapshot.val() || {};

        // Remove any stale queue entries for this user
        await remove(ref(db, `matchmaking_queue/${uid}`));

        for (const [playerID, playerData] of Object.entries(queue)) {
            if (playerID !== uid && Math.abs(playerData.rating - userRating) <= 200) {
                const opponentGameID = await checkExistingGame(playerID);
                if (!opponentGameID) {
                    const gameID = await createGame(playerID, playerData.username, playerData.rating, uid, username, userRating);
                    return { gameID, opponent: playerData };
                }
            }
        }

        await set(ref(db, `matchmaking_queue/${uid}`), {
            username: username,
            rating: userRating,
            timestamp: Date.now()
        });

        return new Promise((resolve) => {
            const userQueueRef = ref(db, `matchmaking_queue/${uid}`);
            let timeoutID;
            let cleanup = false;

            const unsubscribeQueue = onValue(userQueueRef, async (snapshot) => {
                if (cleanup) return false;

                if (!snapshot.exists()) {
                    const existingGameID = await checkExistingGame(uid);
                    if (existingGameID) {
                        cleanup = true;
                        clearTimeout(timeoutID);
                        off(userQueueRef);
                        resolve({ gameID: existingGameID });
                    }
                }
            });

            timeoutID = setTimeout(() => {
                cleanup = true;
                off(userQueueRef);
                remove(ref(db, `matchmaking_queue/${uid}`));
                resolve({ error: 'Match timeout' });
            }, 90000);

            return () => {
                cleanup = true;
                clearTimeout(timeoutID);
                unsubscribeQueue();
                off(userQueueRef);
            };
        });
    } catch (error) {
        console.error('Error in findMatch:', error);
        throw error;
    }
};

/**
 * 
 * @param {string} player1ID Player 1's user ID
 * @param {string} player1Username Player 1's username
 * @param {number} player1Rating Player 1's current rating
 * @param {string} player2ID Player 2's user ID
 * @param {string} player2Username Player 2's username
 * @param {number} player2Rating Player 2's current rating
 * @returns The ID of the created game
 */
export const createGame = async (player1ID, player1Username, player1Rating, player2ID, player2Username, player2Rating, tournamentInfo = null) => {
    const gameID = crypto.randomUUID();
    const gameRef = ref(db, `games/${gameID}`);

    const game = {
        id: gameID,
        state: GameStates.IN_PROGRESS,
        player1: {
            id: player1ID,
            username: player1Username,
            score: 0,
            rating: player1Rating,
            choice: null
        },
        player2: {
            id: player2ID,
            username: player2Username,
            score: 0,
            rating: player2Rating,
            choice: null
        },
        rounds: [],
        currentRound: 1,
        timestamp: Date.now(),
        ...(tournamentInfo && {
            tournamentId: tournamentInfo.tournamentId,
            matchId: tournamentInfo.matchId
        })
    };

    try {
        await Promise.all([
            set(gameRef, game),
            ...(!tournamentInfo ? [
                remove(ref(db, `matchmaking_queue/${player1ID}`)),
                remove(ref(db, `matchmaking_queue/${player2ID}`))
            ] : [])
        ]);

        return gameID;
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

export const determineRoundWinner = (choice1, choice2) => {
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

        if (!game.tournamentId) {
            const mainPlayer = playerID === game.player1.id ? 'p1' : 'p2';
            const result = playerID === game.winner ? GameResults.WIN : GameResults.LOSS;
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

                    const newRating = calculateRating(
                        game.player1.rating,
                        game.player2.rating,
                        playerID === game.winner
                    );

                    await fetch('/api/adjustRating', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            uid: playerID,
                            newRating
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
                            opponentID: game.player1.id,
                            playerRating: game.player2.rating,
                            opponentRating: game.player1.rating,
                            playerScore: game.player2.score,
                            opponentScore: game.player1.score,
                            result,
                            gameStats
                        }),
                    });

                    const newRating = calculateRating(
                        game.player2.rating,
                        game.player1.rating,
                        playerID === game.winner
                    );

                    await fetch('/api/adjustRating', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            uid: playerID,
                            newRating
                        }),
                    });
                }
            } catch (error) {
                console.error('Error sending game stats', error);
            }
        } else {
            await advanceWinner(
                game.tournamentId,
                game.matchId,
                game.winner
            );
        }

        await remove(gameRef);
    } catch (error) {
        console.error('Error ending game:', error);
        throw error;
    }
};