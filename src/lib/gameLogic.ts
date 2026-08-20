import { Game } from "../types";
import config from "@/config/settings.json";
import { postJSON } from "./api";
import { Choice, MatchStatus } from "@/types/neo4j";
import { determineWildcardRoundWinner } from "./wildcardLogic";

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
    playerOneChoices: Record<Choice, number>;
    playerTwoChoices: Record<Choice, number>;
}

/** Number of rounds a player must win to win the game. */
export const FIRST_TO = 4;

/** Consecutive rounds with zero submissions from either player before the game is cancelled. */
export const AFK_ROUND_LIMIT = 3;

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
    const missedRounds = (game.missedRounds ?? 0) + 1;
    if (missedRounds >= AFK_ROUND_LIMIT) {
      return { action: "cancel" };
    }
    // Grace period: void this round (nobody scores) and give the game
    // another AFK_ROUND_LIMIT - missedRounds rounds before cancelling.
    return {
      action: "resolve",
      updates: {
        missedRounds,
        roundStartTimestamp: now,
        [`rounds/${game.currentRound}`]: {
          player1Choice: "none",
          player2Choice: "none",
          winner: "draw",
        },
        currentRound: game.currentRound + 1,
      },
    };
  }

  const bothSubmitted = game.player1.submitted && game.player2.submitted;
  if (!bothSubmitted && !timeExpired) return { action: "noop" };

  const winner = game.mode === "wildcard"
    ? determineWildcardRoundWinner(game.player1.choice, game.player2.choice, game.player1.aBeats, game.player2.aBeats)
    : determineRoundWinner(game.player1.choice, game.player2.choice);
  const isGameOver = winner && (game[winner].score + 1) >= FIRST_TO;

  const updates: Record<string, unknown> = {
    missedRounds: 0,
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
  const empty = () => Object.fromEntries(Object.values(Choice).map((c) => [c, 0])) as Record<Choice, number>;
  const p1Choices = empty();
  const p2Choices = empty();

  Object.values(game.rounds ?? {}).forEach((round) => {
    if (round.player1Choice) p1Choices[round.player1Choice]++;
    if (round.player2Choice) p2Choices[round.player2Choice]++;
  });

  return { playerOneChoices: p1Choices, playerTwoChoices: p2Choices };
};

/**
 * Records stats and adjusts ratings for a completed ranked game (either mode).
 * Only tells the server *which* game to record — `/api/postGameStats` treats
 * the Firebase game record as the sole source of truth and recomputes scores,
 * choice tallies, and rating changes itself rather than trusting values from
 * this call, since this function (and the client-driven blitz/wildcard path
 * that reaches it) is not a trusted boundary.
 */
export async function recordRankedGame(game: Game): Promise<void> {
  if (!game.player1 || !game.player2) return;

  // Server-side callers (the async mode's `matchmakingServer.ts`) have no
  // browser session to authenticate with, so they attach a shared secret
  // instead — mirroring the `CRON_SECRET` pattern used by this app's cron
  // routes. Evaluates to undefined (and is never sent) in the browser bundle.
  const internalSecret = typeof window === "undefined" ? process.env.INTERNAL_API_SECRET : undefined;
  const headers = internalSecret ? { "x-internal-secret": internalSecret } : undefined;

  try {
    await postJSON("/api/postGameStats", { matchId: game.id }, headers);
  } catch (error) {
    console.error("Error recording ranked game:", error);
  }
}
