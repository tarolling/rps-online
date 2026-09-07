import { adminDb } from "@/lib/firebaseAdmin";
import { applyFlatUpdates, computeRoundOutcome, recordRankedGame } from "./gameLogic";
import type { Game } from "@/types";
import { Choice, MatchStatus } from "@/types/neo4j";

/**
 * Server-side (Admin SDK) counterpart to `matchmaking.ts`'s client-driven game
 * lifecycle. Used exclusively by async-mode game resolution, which cannot rely
 * on any browser tab being open — see `/api/games/submitChoice` (submission-
 * triggered resolution) and `/api/cron/resolveAsyncRounds` (the timeout
 * backstop for rounds nobody acts on). Never import this from a "use client" file.
 *
 * Deliberately imports round/game logic from `gameLogic.ts`, not `matchmaking.ts`
 * — the latter calls the Firebase *client* SDK's `getDatabase()` at module
 * scope, which throws when evaluated in a server-only context with no browser
 * app initialized (this broke `next build`'s page-data collection for the
 * cron route before this was split out).
 */

/** Finalises a completed/cancelled async game: records stats, removes the RTDB node. */
export async function endGameServer(game: Game): Promise<void> {
  try {
    if (game.state !== MatchStatus.Cancelled) {
      await recordRankedGame(game);
    }
  } catch (err) {
    // Cleanup must still happen even if stats recording fails, otherwise the
    // game node is stuck forever in Completed/Cancelled state, invisible to
    // sweepExpiredAsyncRounds (which only scans state === InProgress).
    console.error(`Failed to record ranked stats for game ${game.id}:`, err);
  } finally {
    await adminDb.ref(`games/${game.id}`).remove();
  }
}

/**
 * Server-side equivalent of `resolveRound`, safe to call concurrently from
 * both the submission-triggered path and the cron sweep — the RTDB transaction
 * ensures `computeRoundOutcome` only ever acts on one consistent read of the
 * game, so a race between the two triggers can't double-resolve a round.
 *
 * `shouldFinalize` is only set true when THIS transaction attempt is the one
 * that actually cancels/completes the game — not when it merely observes a
 * game some other concurrent call already finished — so a racing caller that
 * shows up after the game is done (but before the winning caller has removed
 * the RTDB node) can't trigger a second `endGameServer` and double-record stats.
 *
 * @returns `{ winner: uid }` if the game just ended, otherwise null.
 */
export async function resolveRoundServer(gameId: string): Promise<{ winner: string } | null> {
  const gameRef = adminDb.ref(`games/${gameId}`);
  let outcomeWinner: string | undefined;
  let shouldFinalize = false;

  const txResult = await gameRef.transaction((current: Game | null) => {
    outcomeWinner = undefined;
    shouldFinalize = false;
    // Nothing to do — game missing, or already resolved/finalised by another call.
    if (!current || current.state !== MatchStatus.InProgress) return current;

    const outcome = computeRoundOutcome(current, Date.now());
    if (outcome.action === "noop") return; // abort — nothing to do yet

    if (outcome.action === "cancel") {
      shouldFinalize = true;
      return { ...current, state: MatchStatus.Cancelled };
    }

    const next = applyFlatUpdates(current, outcome.updates!);
    if (next.state === MatchStatus.Completed) {
      shouldFinalize = true;
      outcomeWinner = next.winner;
    }
    return next;
  });

  if (!txResult.committed) return null;
  if (!shouldFinalize) return null;

  const finalGame: Game = txResult.snapshot.val();
  if (!finalGame) return null;

  await endGameServer(finalGame);

  return outcomeWinner ? { winner: outcomeWinner } : null;
}

/**
 * Records a player's choice for the current round via the Admin SDK, then
 * always attempts server-side resolution — `resolveRoundServer`'s transaction
 * safely no-ops if the opponent hasn't submitted yet and the deadline hasn't
 * passed, so there's no need (or race) to check the opponent's status first.
 *
 * The validate-then-write has to happen inside a single `.transaction()` on
 * the game node rather than a plain `get()` + `update()`: a separate read and
 * write leaves a window where a concurrent `resolveRoundServer` call (the
 * opponent's own submission, or the cron sweep hitting the round deadline)
 * can finish, finalize the game, and `remove()` the RTDB node in the middle of
 * it. The stray `update()` would then silently recreate a phantom node
 * containing only the choice/submitted fields (RTDB `update()` creates
 * missing paths), which the client renders as "Game not found." Running the
 * whole thing as one transaction means a concurrent removal forces this to
 * retry against the latest snapshot (`null`) instead.
 */
export async function submitChoiceServer(gameId: string, playerId: string, choice: Choice): Promise<void> {
  const gameRef = adminDb.ref(`games/${gameId}`);
  let failure: string | null = null;

  const txResult = await gameRef.transaction((current: Game | null) => {
    failure = null;
    if (!current) {
      failure = "Game not found.";
      return; // abort, no write
    }
    if (current.state !== MatchStatus.InProgress) {
      failure = "Game is not in progress.";
      return;
    }
    if (playerId !== current.player1.id && playerId !== current.player2.id) {
      failure = "Player is not part of this game.";
      return;
    }

    const playerKey = playerId === current.player1.id ? "player1" : "player2";
    if (current[playerKey].submitted) return; // already submitted: idempotent no-op, not an error

    return applyFlatUpdates(current, {
      [`${playerKey}/choice`]: choice,
      [`${playerKey}/submitted`]: true,
    });
  });

  if (!txResult.committed && failure) throw new Error(failure);

  await resolveRoundServer(gameId);
}

/**
 * Scans all async, in-progress games for rounds whose deadline has passed and
 * force-resolves them. Backstop for rounds where a player never submits and
 * the opponent never returns to trigger `submitChoiceServer` either.
 */
export async function sweepExpiredAsyncRounds(): Promise<{ checked: number; resolved: number }> {
  const snapshot = await adminDb.ref("games").get();
  const games: Record<string, Game> = snapshot.val() ?? {};
  const now = Date.now();

  const expired = Object.values(games).filter((game) =>
    game.mode === "async" &&
        game.state === MatchStatus.InProgress &&
        game.roundStartTimestamp !== undefined &&
        now - game.roundStartTimestamp >= (game.roundDurationSeconds ?? 0) * 1000,
  );

  const results = await Promise.allSettled(expired.map((game) => resolveRoundServer(game.id)));
  const resolved = results.filter((r) => r.status === "fulfilled").length;

  return { checked: expired.length, resolved };
}
