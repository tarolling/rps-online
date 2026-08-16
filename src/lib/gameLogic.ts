import { Game, PlayMode } from "../types";
import calculateRating from "./calculateRating";
import config from "@/config/settings.json";
import { postJSON } from "./api";
import { Choice, MatchStatus } from "@/types/neo4j";

/**
 * Pure round/game logic shared by the client-driven blitz path
 * (`matchmaking.ts`, which needs the Firebase client SDK) and the server-driven
 * async path (`matchmakingServer.ts`, which needs the Firebase Admin SDK).
 *
 * This module must never import `firebase/database` or `firebase-admin` —
 * importing either one at module scope throws immediately in the other SDK's
 * context (e.g. the client SDK's `getDatabase()` throws server-side during
 * `next build`'s page-data collection, since no browser app is initialized
 * there). Keeping this module free of both keeps it safely importable from
 * both "use client" pages and server-only API routes.
 */

interface GameStats {
    playerOneChoices: { ROCK: number; PAPER: number; SCISSORS: number };
    playerTwoChoices: { ROCK: number; PAPER: number; SCISSORS: number };
}

/** Number of rounds a player must win to win the game. */
export const FIRST_TO = 4;

export interface RoundOutcome {
    action: "cancel" | "noop" | "resolve";
    updates?: Record<string, unknown>;
    /** uid of the winner, set only when this round resolution also ends the game */
    gameOverWinnerId?: string;
}

/**
 * Pure decision logic for what should happen to a game's current round, given
 * its current state and the current time. Contains no I/O — callers (the
 * client-driven blitz path in `matchmaking.ts`'s `resolveRound`, and the
 * server-driven async paths in `matchmakingServer.ts`) are responsible for
 * reading the game and applying the returned updates.
 */
export function computeRoundOutcome(game: Game, now: number): RoundOutcome {
  const roundDurationSeconds = game.roundDurationSeconds ?? config.roundTimeout;
  // roundStartTimestamp should never be undefined here
  const elapsed = now - game.roundStartTimestamp!;
  const timeExpired = elapsed >= roundDurationSeconds * 1000;
  const neitherSubmitted = !game.player1.submitted && !game.player2.submitted;
  if (neitherSubmitted) {
    return { action: "cancel" };
  }

  const bothSubmitted = game.player1.submitted && game.player2.submitted;
  if (!bothSubmitted && !timeExpired) return { action: "noop" };

  const winner = determineRoundWinner(game.player1.choice, game.player2.choice);
  const isGameOver = winner && (game[winner].score + 1) >= FIRST_TO;

  const updates: Record<string, unknown> = {
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
    roundStartTimestamp: now,
  };

  let gameOverWinnerId: string | undefined;
  if (winner) {
    const newScore = game[winner].score + 1;
    updates[`${winner}/score`] = newScore;
    if (newScore >= FIRST_TO) {
      updates.state = MatchStatus.Completed;
      updates.winner = game[winner].id;
      updates.endTimestamp = now;
      gameOverWinnerId = game[winner].id;
    }
  }

  return { action: "resolve", updates, gameOverWinnerId };
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

/**
 * Records stats and adjusts ratings for a completed ranked game (either mode).
 * Always called from the perspective of the player who triggered `endGame`,
 * which is player 1.
 */
export async function recordRankedGame(game: Game, mode: PlayMode = "blitz"): Promise<void> {
  if (!game.player1 || !game.player2) return;
  const { player1: { id: playerOneId, rating: playerOneRating }, player2: { id: playerTwoId, rating: playerTwoRating }, winner } = game;

  const gameStats = calculateGameStats(game);

  // calculate both players' new ratings
  const playerOneNewRating = calculateRating(playerOneRating, playerTwoRating, playerOneId === winner);
  const playerTwoNewRating = calculateRating(playerTwoRating, playerOneRating, playerTwoId === winner);

  const gameMode = mode === "async" ? "ranked_async" : "ranked";

  try {
    await Promise.all([
      postJSON("/api/postGameStats", {
        matchId: game.id,
        gameMode,
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
      postJSON("/api/adjustRating", { uid: playerOneId, newRating: playerOneNewRating, mode }),
      postJSON("/api/adjustRating", { uid: playerTwoId, newRating: playerTwoNewRating, mode }),
    ]);
  } catch (error) {
    console.error("Error recording ranked game:", error);
  }
}
