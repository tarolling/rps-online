import { getDatabase, ref, set, get, update, remove, onValue, off, runTransaction } from "firebase/database";
import { Game, PlayMode } from "../types";
import { advanceWinner } from "./tournaments";
import config from "@/config/settings.json";
import { postJSON } from "./api";
import { MatchStatus } from "@/types/neo4j";
import { computeRoundOutcome, recordRankedGame, FIRST_TO } from "./gameLogic";
import { GAME_MODES } from "./gameModes";

// Re-exported so existing consumers (game/[gameId]/page.tsx, playAI/page.tsx,
// tournaments.ts) don't need to change their import paths. The underlying
// logic lives in gameLogic.ts because it must be importable from server-only
// code too (see matchmakingServer.ts) without pulling in the Firebase client SDK.
export { FIRST_TO, computeRoundOutcome, recordRankedGame };
export { determineRoundWinner, calculateGameStats } from "./gameLogic";
export type { RoundOutcome } from "./gameLogic";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TournamentInfo {
    tournamentId: string;
    matchId: string;
}

interface QueueEntry {
    uid: string;
    username: string;
    rating: number;
    mode: PlayMode;
    timestamp: number;
    isBot?: boolean;
    claimed?: boolean;
}

type MatchResult = { gameID: string } | { error: string } | { gameID: string, opponent: QueueEntry } | { queued: true };

const db = getDatabase();

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * The matchmaking queue is keyed by mode + uid (not bare uid) so a player can
 * have an independent blitz search and async search in flight at the same
 * time without one overwriting the other.
 */
export function matchmakingQueueKey(uid: string, mode: PlayMode = "blitz"): string {
  return `${mode}_${uid}`;
}

/**
 * Returns the ID of an in-progress game the given player is currently in
 * (for that mode), or null if none exists.
 */
async function checkExistingGame(uid: string, mode: PlayMode = "blitz"): Promise<string | null> {
  const snapshot = await get(ref(db, "games"));
  const games = snapshot.val() || {};

  for (const game of Object.values(games) as Game[]) {
    if (
      (game.mode ?? "blitz") === mode &&
            (game.state === MatchStatus.InProgress || game.state === MatchStatus.Waiting) &&
            (game.player1.id === uid || game.player2.id === uid)
    ) {
      return game.id;
    }
  }
  return null;
}

/**
 * Counts the given player's in-progress async games, for the free-tier
 * concurrency cap. Known limitation: this only gates the `findMatch` call
 * path — since matchmaking runs client-side against Firebase RTDB with no
 * server-side authorization layer (same trust model as the rest of this
 * file, e.g. `userRating` is likewise client-supplied), a motivated free
 * user could write directly to `matchmaking_queue` and bypass this. It's a
 * UI-level speed bump, not real enforcement.
 */
async function countActiveAsyncGames(uid: string): Promise<number> {
  const snapshot = await get(ref(db, "games"));
  const games = snapshot.val() || {};
  let count = 0;
  for (const game of Object.values(games) as Game[]) {
    if (
      game.mode === "async" &&
            (game.state === MatchStatus.InProgress || game.state === MatchStatus.Waiting) &&
            (game.player1.id === uid || game.player2.id === uid)
    ) {
      count += 1;
    }
  }
  return count;
}

// ── Matchmaking ───────────────────────────────────────────────────────────────

/**
 * Attempts to find a match for the given player.
 *
 * Blitz mode (default):
 * - If the player is already in a blitz game, returns that game ID immediately.
 * - If a suitable opponent (within `matchmakingRatingRange`) is in the queue, creates a game.
 * - Otherwise, adds the player to the queue and waits up to 90 seconds for an
 *   opponent to match with them.
 *
 * Async mode:
 * - Players may have several concurrent async games, so no "already in a game"
 *   short-circuit is applied.
 * - If a suitable opponent is already queued for async, matches immediately.
 * - Otherwise, enqueues the player and returns right away — no blocking wait,
 *   since an async opponent may not show up for a long time. The match happens
 *   passively the next time another async player calls `findMatch`.
 *
 * @returns `{ gameID }` on an immediate match, `{ queued: true }` if enqueued
 * for async with no immediate match, `{ error: 'Match timeout' }` if a blitz
 * search timed out, or `{ error: ... }` if a free-tier async player is at
 * their concurrent game limit.
 */
export async function findMatch(uid: string, username: string, userRating: number, mode: PlayMode = "blitz", isPremium = false): Promise<MatchResult> {
  const queueRef = ref(db, "matchmaking_queue");
  const myQueueKey = matchmakingQueueKey(uid, mode);

  try {
    if (GAME_MODES[mode].live) {
      const existingGameId = await checkExistingGame(uid, mode);
      if (existingGameId) return { gameID: existingGameId };
    }

    if (mode === "async" && !isPremium) {
      const activeCount = await countActiveAsyncGames(uid);
      if (activeCount >= config.async.freeConcurrentGameLimit) {
        return { error: `Free accounts are limited to ${config.async.freeConcurrentGameLimit} concurrent async games. Upgrade to Premium for unlimited games.` };
      }
    }

    const snapshot = await get(queueRef);
    const queue = snapshot.val() || {};

    // Clear any stale queue entry for this user+mode before searching
    await remove(ref(db, `matchmaking_queue/${myQueueKey}`));

    for (const [queueKey, playerData] of Object.entries(queue) as [string, QueueEntry][]) {
      const candidateUid: string = playerData.uid;
      const sameMode = (playerData.mode ?? "blitz") === mode;
      const ratingClose = Math.abs(playerData.rating - userRating) <= config.matchmakingRatingRange;
      if (candidateUid === uid || !sameMode || !ratingClose) continue;

      // Atomically claim this candidate's queue slot so no other concurrent
      // matchmaking attempt can also grab them. This marks the entry rather
      // than deleting it outright — deletion is deferred until after the game
      // is actually created (below). The candidate's own findMatch call is
      // waiting on this entry to disappear as its "you've been matched"
      // signal, then looks up the new game; deleting it here, before
      // games/{gameId} is written, left a window where that lookup could run
      // before the game existed, with no retry — so the candidate never got
      // pulled in and just sat until the 90s timeout.
      const candidateRef = ref(db, `matchmaking_queue/${queueKey}`);
      const { committed } = await runTransaction(candidateRef, (current) => (
        current === null || current.claimed ? undefined : { ...current, claimed: true }
      ));
      if (!committed) continue; // another search already claimed this candidate

      if (GAME_MODES[mode].live) {
        const opponentInGame = await checkExistingGame(candidateUid, mode);
        if (opponentInGame) {
          await set(candidateRef, playerData); // shouldn't normally happen, but put them back
          continue;
        }
      }

      const gameId = await createGame(
        candidateUid, playerData.username, playerData.rating,
        uid, username, userRating,
        null, mode,
      );
      if (playerData.isBot) {
        await set(ref(db, `games/${gameId}/presence/${candidateUid}`), true);
        // bot plays the game server-side
        postJSON("/api/botPlay", { gameId: gameId, botId: candidateUid });
      }

      // Now that games/{gameId} is durably written, it's safe to remove the
      // candidate's queue entry — their listener will find the game on lookup.
      await remove(candidateRef);
      return { gameID: gameId, opponent: playerData };
    }

    // No match found — add to queue
    await set(ref(db, `matchmaking_queue/${myQueueKey}`), {
      uid,
      username,
      rating: userRating,
      mode,
      timestamp: Date.now(),
    });

    // Non-live modes: don't block the caller waiting for a match that may take
    // a while to show up — the player can navigate away and check back later.
    if (!GAME_MODES[mode].live) {
      return { queued: true };
    }

    return new Promise((resolve) => {
      const userQueueRef = ref(db, `matchmaking_queue/${myQueueKey}`);
      let done = false;

      const timeoutID = setTimeout(() => {
        done = true;
        off(userQueueRef);
        remove(ref(db, `matchmaking_queue/${myQueueKey}`));
        resolve({ error: "Match timeout" });
      }, 90_000);

      const unsubscribe = onValue(userQueueRef, async (snapshot) => {
        if (done) return;

        // Entry removed means an opponent matched us
        if (!snapshot.exists()) {
          const gameID = await checkExistingGame(uid, mode);
          if (gameID) {
            done = true;
            clearTimeout(timeoutID);
            off(userQueueRef);
            resolve({ gameID });
          }
        }
      });

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
  mode: PlayMode = "blitz",
): Promise<string> {
  const gameId = crypto.randomUUID();
  const roundDurationSeconds = GAME_MODES[mode].roundDurationSeconds;

  // Live modes (blitz, wildcard) wait in the WAITING state until both players'
  // live presence is detected (see game/[gameId]/page.tsx) before starting the
  // round clock. Non-live modes (async) are never simultaneously "present" for
  // a 24h round, so the match starts immediately and the first round's clock
  // begins right away.
  const startsImmediately = !GAME_MODES[mode].live;

  const game: Game = {
    id: gameId,
    state: startsImmediately ? MatchStatus.InProgress : MatchStatus.Waiting,
    mode,
    roundDurationSeconds,
    player1: { id: playerOneId, username: playerOneUsername, score: 0, rating: playerOneRating, choice: null, submitted: false },
    player2: { id: playerTwoId, username: playerTwoUsername, score: 0, rating: playerTwoRating, choice: null, submitted: false },
    rounds: [],
    currentRound: 1,
    timestamp: Date.now(),
    ...(startsImmediately && { roundStartTimestamp: Date.now() }),
    // Wildcard games need a pregame "pick your A config" step before round 1's
    // timer can start — see game/wildcard/[gameId]/page.tsx.
    ...(mode === "wildcard" && { configPhase: true }),
    ...(tournamentInfo && {
      tournamentId: tournamentInfo.tournamentId,
      matchId: tournamentInfo.matchId,
    }),
  };

  try {
    // Queue cleanup for the matched pair is the caller's responsibility (see
    // findMatch) — it happens with mode-prefixed keys and, for the queued
    // candidate, only after this write is confirmed, since their listener
    // treats queue-entry removal as the "your game is ready" signal.
    await set(ref(db, `games/${gameId}`), game);
    return gameId;
  } catch (error) {
    console.error("Error creating game:", error);
    throw error;
  }
}

// ── Round resolution (client-driven blitz path — pure decision logic lives in gameLogic.ts) ───

/**
 * Resolves the current round of a game once both players have submitted choices.
 * Updates scores and, if a player has reached FIRST_TO wins, marks the game finished.
 * Client-driven (blitz only) — async rounds are resolved server-side, see `matchmakingServer.ts`.
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

    const outcome = computeRoundOutcome(game, Date.now());
    if (outcome.action === "noop") return null;

    if (outcome.action === "cancel") {
      await update(gameRef, { state: MatchStatus.Cancelled });
      await endGame(gameId);
      return null;
    }

    await update(gameRef, outcome.updates!);

    if (outcome.gameOverWinnerId) {
      await endGame(gameId);
      return { winner: outcome.gameOverWinnerId };
    }
    return null;
  } catch (error) {
    console.error("Error resolving round:", error);
    throw error;
  }
}

// ── End game ──────────────────────────────────────────────────────────────────

/**
 * Finalises a completed game:
 * - For ranked games: records stats and adjusts both players' ratings.
 * - For tournament games: advances the winner to the next match.
 * - Removes the game from the database.
 *
 * Client-driven (blitz only) — async games are finalised server-side, see
 * `matchmakingServer.ts`'s `endGameServer`.
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
      await recordRankedGame(game, game.mode ?? "blitz");
      if (game.tournamentId) {
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
