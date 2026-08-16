import { adminDb } from "@/lib/firebaseAdmin";
import { computeRoundOutcome, recordRankedGame } from "./gameLogic";
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

/**
 * Applies a Firebase-style flattened update map (e.g. `{ "player1/choice": null }`)
 * onto a plain object copy, the way the Realtime Database's `update()` would.
 */
function applyFlatUpdates<T extends Record<string, any>>(obj: T, updates: Record<string, any>): T {
  const next: any = JSON.parse(JSON.stringify(obj));
  for (const [path, value] of Object.entries(updates)) {
    const parts = path.split("/");
    let cursor = next;
    for (let i = 0; i < parts.length - 1; i++) {
      cursor[parts[i]] ??= {};
      cursor = cursor[parts[i]];
    }
    cursor[parts[parts.length - 1]] = value;
  }
  return next;
}

/** Finalises a completed/cancelled async game: records stats, removes the RTDB node. */
export async function endGameServer(game: Game): Promise<void> {
  if (game.state !== MatchStatus.Cancelled) {
    await recordRankedGame(game, "async");
  }
  await adminDb.ref(`games/${game.id}`).remove();
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
 */
export async function submitChoiceServer(gameId: string, playerId: string, choice: Choice): Promise<void> {
  const gameRef = adminDb.ref(`games/${gameId}`);
  const snap = await gameRef.get();
  const game: Game = snap.val();
  if (!game) throw new Error("Game not found.");
  if (game.state !== MatchStatus.InProgress) throw new Error("Game is not in progress.");
  if (playerId !== game.player1.id && playerId !== game.player2.id) {
    throw new Error("Player is not part of this game.");
  }

  const playerKey = playerId === game.player1.id ? "player1" : "player2";
  if (!game[playerKey].submitted) {
    await gameRef.update({
      [`${playerKey}/choice`]: choice,
      [`${playerKey}/submitted`]: true,
    });
  }

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
