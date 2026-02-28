import { getDatabase, ref, set, get, update, remove, onValue, off } from "firebase/database";
import { Game } from "../types";
import calculateRating from "./calculateRating";
import { advanceWinner } from "./tournaments";
import config from "@/config/settings.json";
import { postJSON } from "./api";
import { Choice, MatchStatus } from "@/types/neo4j";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TournamentInfo {
    tournamentId: string;
    matchId: string;
}

interface GameStats {
    playerOneChoices: { ROCK: number; PAPER: number; SCISSORS: number };
    playerTwoChoices: { ROCK: number; PAPER: number; SCISSORS: number };
}

type MatchResult = { gameID: string } | { error: string } | { gameID: string, opponent: any };

/** Number of rounds a player must win to win the game. */
export const FIRST_TO = 4;

const db = getDatabase();

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Returns the ID of an in-progress game the given player is currently in,
 * or null if none exists.
 */
async function checkExistingGame(uid: string): Promise<string | null> {
  const snapshot = await get(ref(db, "games"));
  const games = snapshot.val() || {};

  for (const game of Object.values(games) as Game[]) {
    if (
      (game.state === MatchStatus.InProgress || game.state === MatchStatus.Waiting) &&
            (game.player1.id === uid || game.player2.id === uid)
    ) {
      return game.id;
    }
  }
  return null;
}

// ── Matchmaking ───────────────────────────────────────────────────────────────

/**
 * Attempts to find a match for the given player.
 *
 * - If the player is already in a game, returns that game ID immediately.
 * - If a suitable opponent (within 200 rating) is in the queue, creates a game.
 * - Otherwise, adds the player to the queue and waits up to 90 seconds for an
 *   opponent to match with them.
 *
 * @returns `{ gameID }` on success, or `{ error: 'Match timeout' }` on timeout.
 */
export async function findMatch(uid: string, username: string, userRating: number): Promise<MatchResult> {
  const queueRef = ref(db, "matchmaking_queue");

  try {
    const existingGameId = await checkExistingGame(uid);
    if (existingGameId) return { gameID: existingGameId };

    const snapshot = await get(queueRef);
    const queue = snapshot.val() || {};

    // Clear any stale queue entry for this user before searching
    await remove(ref(db, `matchmaking_queue/${uid}`));

    for (const [playerId, playerData] of Object.entries(queue) as [string, any][]) {
      const ratingClose = Math.abs(playerData.rating - userRating) <= config.matchmakingRatingRange;
      if (playerId !== uid && ratingClose) {
        const opponentInGame = await checkExistingGame(playerId);
        if (!opponentInGame) {
          const gameID = await createGame(
            playerId, playerData.username, playerData.rating,
            uid, username, userRating,
          );
          if (playerData.isBot) {
            await set(ref(db, `games/${gameID}/presence/${playerId}`), true);
            // bot plays the game server-side
            postJSON("/api/botPlay", { gameId: gameID, botId: playerId });
          }
          return { gameID, opponent: playerData };
        }
      }
    }

    // No match found — add to queue and wait
    await set(ref(db, `matchmaking_queue/${uid}`), {
      username,
      rating: userRating,
      timestamp: Date.now(),
    });

    return new Promise((resolve) => {
      const userQueueRef = ref(db, `matchmaking_queue/${uid}`);
      let timeoutID: NodeJS.Timeout;
      let done = false;

      const unsubscribe = onValue(userQueueRef, async (snapshot) => {
        if (done) return;

        // Entry removed means an opponent matched us
        if (!snapshot.exists()) {
          const gameID = await checkExistingGame(uid);
          if (gameID) {
            done = true;
            clearTimeout(timeoutID);
            off(userQueueRef);
            resolve({ gameID });
          }
        }
      });

      timeoutID = setTimeout(() => {
        done = true;
        off(userQueueRef);
        remove(ref(db, `matchmaking_queue/${uid}`));
        resolve({ error: "Match timeout" });
      }, 90_000);

      return () => {
        done = true;
        clearTimeout(timeoutID);
        unsubscribe();
        off(userQueueRef);
      };
    });
  } catch (error) {
    console.error("Error in findMatch:", error);
    throw error;
  }
};

// ── Game lifecycle ────────────────────────────────────────────────────────────

/**
 * Creates a new game between two players and removes both from the matchmaking
 * queue (unless this is a tournament game, in which case the queue is untouched).
 *
 * @returns The ID of the newly created game.
 */
export async function createGame(
  playerOneId: string,
  playerOneUsername: string,
  playerOneRating: number,
  playerTwoId: string,
  playerTwoUsername: string,
  playerTwoRating: number,
  tournamentInfo: TournamentInfo | null = null,
): Promise<string> {
  const gameId = crypto.randomUUID();

  const game: Game = {
    id: gameId,
    state: MatchStatus.Waiting,
    player1: { id: playerOneId, username: playerOneUsername, score: 0, rating: playerOneRating, choice: null, submitted: false },
    player2: { id: playerTwoId, username: playerTwoUsername, score: 0, rating: playerTwoRating, choice: null, submitted: false },
    rounds: [],
    currentRound: 1,
    timestamp: Date.now(),
    ...(tournamentInfo && {
      tournamentId: tournamentInfo.tournamentId,
      matchId: tournamentInfo.matchId,
    }),
  };

  try {
    await Promise.all([
      set(ref(db, `games/${gameId}`), game),
      ...(!tournamentInfo ? [
        remove(ref(db, `matchmaking_queue/${playerOneId}`)),
        remove(ref(db, `matchmaking_queue/${playerTwoId}`)),
      ] : []),
    ]);
    return gameId;
  } catch (error) {
    console.error("Error creating game:", error);
    throw error;
  }
}

/**
 * Resolves the current round of a game once both players have submitted choices.
 * Updates scores and, if a player has reached FIRST_TO wins, marks the game finished.
 *
 * @returns `{ winner: uid }` if the game just ended, otherwise null.
 */
export async function resolveRound(gameId: string, playerId: string) {
  const gameRef = ref(db, `games/${gameId}`);
  try {
    const snapshot = await get(gameRef);
    if (!snapshot.exists()) return null;
    const game: Game = snapshot.val();

    // prevent duplicate writes
    if (playerId !== game.player1.id) return null;

    // roundStartTimestamp should never be undefined here
    const elapsed = Date.now() - game.roundStartTimestamp!;
    const timeExpired = elapsed >= config.roundTimeout * 1000;
    const neitherSubmitted = !game.player1.submitted && !game.player2.submitted;
    if (neitherSubmitted) {
      await update(gameRef, { state: MatchStatus.Cancelled });
      await endGame(gameId);
      return null;
    }

    const bothSubmitted = game.player1.submitted && game.player2.submitted;
    if (!bothSubmitted && !timeExpired) return null;

    const winner = determineRoundWinner(game.player1.choice, game.player2.choice);
    const isGameOver = winner && (game[winner].score + 1) >= FIRST_TO;

    const updates: Record<string, any> = {
      "player1/choice": null,
      "player1/submitted": false,
      "player2/choice": null,
      "player2/submitted": false,
      "player1/score": game.player1.score,
      "player2/score": game.player2.score,
      [`rounds/${game.currentRound}`]: {
        player1Choice: game.player1.choice ?? "none",
        player2Choice: game.player2.choice ?? "none",
        winner: winner ?? "draw",
      },
      currentRound: isGameOver ? game.currentRound : game.currentRound + 1,
      roundStartTimestamp: Date.now(),
    };

    if (winner) {
      const newScore = game[winner].score + 1;
      updates[`${winner}/score`] = newScore;
      if (newScore >= FIRST_TO) {
        updates.state = MatchStatus.Completed;
        updates.winner = game[winner].id;
        updates.endTimestamp = Date.now();
      }
    }

    await update(gameRef, updates);

    if (updates.state === MatchStatus.Completed) {
      await endGame(gameId);
      return { winner: updates.winner };
    }
    return null;
  } catch (error) {
    console.error("Error resolving round:", error);
    throw error;
  }
}

/**
 * Determines the winner of a single round given two choices.
 *
 * @returns `'player1'`, `'player2'`, or `null` for a draw / no choices.
 */
export function determineRoundWinner(choice1: Choice | null, choice2: Choice | null): "player1" | "player2" | null {
  if (choice1 === null && choice2 === null) return null;
  if (!choice1) return "player2";
  if (!choice2) return "player1";
  if (choice1 === choice2) return null;

  const beats: Partial<Record<Choice, Choice>> = {
    [Choice.Rock]: Choice.Scissors,
    [Choice.Paper]: Choice.Rock,
    [Choice.Scissors]: Choice.Paper,
  };

  return beats[choice1] === choice2 ? "player1" : "player2";
}

// ── Stats ─────────────────────────────────────────────────────────────────────

/**
 * Aggregates choice counts across all rounds from the perspective of a given player.
 *
 * @param mainPlayer - `'p1'` or `'p2'` — which side to treat as "the player".
 */
export const calculateGameStats = (game: Game): GameStats => {
  const p1Choices = { ROCK: 0, PAPER: 0, SCISSORS: 0 };
  const p2Choices = { ROCK: 0, PAPER: 0, SCISSORS: 0 };

  game.rounds?.forEach((round) => {
    if (round.player1Choice) p1Choices[round.player1Choice]++;
    if (round.player2Choice) p2Choices[round.player2Choice]++;
  });

  return { playerOneChoices: p1Choices, playerTwoChoices: p2Choices };
};

// ── End game ──────────────────────────────────────────────────────────────────

/**
 * Finalises a completed game:
 * - For ranked games: records stats and adjusts both players' ratings.
 * - For tournament games: advances the winner to the next match.
 * - Removes the game from the database.
 */
export async function endGame(gameId: string): Promise<void> {
  const gameRef = ref(db, `games/${gameId}`);

  try {
    const snapshot = await get(gameRef);
    const game: Game = snapshot.val();
    if (!game) return;

    // if no winner, both players didn't respond or both dc'd
    // don't record 
    if (game.state !== MatchStatus.Cancelled) {
      if (!game.tournamentId) {
        await recordRankedGame(game);
      } else {
        await advanceWinner(game.tournamentId, game.matchId!, game.winner!);
      }
    } else {
      // advance random player
      if (game.tournamentId) {
        await advanceWinner(game.tournamentId, game.matchId!, game.player1.id);
      }
    }

    await remove(gameRef);
  } catch (error) {
    console.error("Error ending game:", error);
    throw error;
  }
};

/**
 * Records stats and adjusts ratings for a completed ranked game.
 * Always called from the perspective of the player who triggered `endGame`,
 * which is player 1.
 */
async function recordRankedGame(game: Game): Promise<void> {
  if (!game.player1 || !game.player2) return;
  const { player1: { id: playerOneId, rating: playerOneRating }, player2: { id: playerTwoId, rating: playerTwoRating }, winner } = game;

  const gameStats = calculateGameStats(game);

  // calculate both players' new ratings
  const playerOneNewRating = calculateRating(playerOneRating, playerTwoRating, playerOneId === winner);
  const playerTwoNewRating = calculateRating(playerTwoRating, playerOneRating, playerTwoId === winner);

  try {
    await Promise.all([
      postJSON("/api/postGameStats", {
        matchId: game.id,
        playerOneId,
        playerTwoId,
        playerOneScore: game.player1.score,
        playerOneRating,
        playerOneNewRating,
        playerOneRocks: gameStats.playerOneChoices.ROCK,
        playerOnePapers: gameStats.playerOneChoices.PAPER,
        playerOneScissors: gameStats.playerOneChoices.SCISSORS,
        playerTwoScore: game.player2.score,
        playerTwoRating,
        playerTwoNewRating,
        playerTwoRocks: gameStats.playerTwoChoices.ROCK,
        playerTwoPapers: gameStats.playerTwoChoices.PAPER,
        playerTwoScissors: gameStats.playerTwoChoices.SCISSORS,
        winnerId: winner,
        // filter out blank rounds that are created when match ends 
        rounds: game.rounds.filter((r) => r.player1Choice !== null && r.player2Choice !== null),
      }),
      postJSON("/api/adjustRating", { uid: playerOneId, newRating: playerOneNewRating }),
      postJSON("/api/adjustRating", { uid: playerTwoId, newRating: playerTwoNewRating }),
    ]);
  } catch (error) {
    console.error("Error recording ranked game:", error);
  }
}

/**
 * Award one player a win if the other disconnects
 * @param gameId The game ID as it exists in Firebase
 * @param winnerId The winner's user ID
 * @returns 
 */
export async function awardWinByDisconnect(gameId: string, winnerId: string): Promise<void> {
  const gameRef = ref(db, `games/${gameId}`);
  const snapshot = await get(gameRef);
  if (!snapshot.exists()) return;

  const game: Game = snapshot.val();
  if (game.state !== MatchStatus.InProgress) return; // already resolved

  await update(gameRef, {
    state: MatchStatus.Completed,
    winner: winnerId,
    endTimestamp: Date.now(),
    disconnectWin: true,
  });

  await endGame(gameId);
}