import neo4j from "neo4j-driver";
import { runQuery } from "@/lib/neo4j";
import { RANK_TIERS } from "@/lib/ranks";
import {
  GAMES_PLAYED_TITLES,
  INFINITY_RANK_TITLE,
  TOURNAMENT_CHAMPION_TITLE,
  WIN_STREAK_TITLES,
  crossedTitles,
  type TitleDefinition,
} from "@/lib/titles";

const INFINITY_MIN_RATING = RANK_TIERS.find((t) => t.rank === "Infinity")!.minRating;

/**
 * Grants a title, creating the Title node on first award. Idempotent — MERGE
 * on both the node and the EARNED_TITLE relationship, so calling this again
 * for a title the player already has is a harmless no-op.
 */
async function awardTitle(uid: string, title: TitleDefinition): Promise<void> {
  await runQuery(`
    MATCH (p:Player {uid: $uid})
    MERGE (t:Title {id: $id})
    ON CREATE SET t.name = $name, t.description = $description, t.rarity = $rarity
    MERGE (p)-[e:EARNED_TITLE]->(t)
    ON CREATE SET e.awardedAt = datetime()
    `, { uid, id: title.id, name: title.name, description: title.description, rarity: title.rarity }, "write");
}

/**
 * Checks the auto-awarded, per-match title conditions for one player right
 * after their match has been recorded (so PARTICIPATED_IN for this match
 * already exists) and their rating already updated. Best-effort: a failure
 * here must never fail the match-recording request that called it.
 *
 * Checks the player's live totals against every tier (not just whichever one
 * was "just" crossed) so a player who already qualified for a title before
 * it existed — or before they started being checked — gets it the next time
 * they finish a match, with no separate backfill needed.
 */
export async function checkAndAwardMatchTitles(uid: string, newRating: number): Promise<void> {
  try {
    if (newRating >= INFINITY_MIN_RATING) {
      await awardTitle(uid, INFINITY_RANK_TITLE);
    }

    const result = await runQuery(`
      MATCH (p:Player {uid: $uid})-[r:PARTICIPATED_IN]->(m:Match)
      WITH r, m ORDER BY m.timestamp ASC
      WITH collect(r.result) AS resultsAsc
      RETURN size(resultsAsc) AS totalGames,
             reduce(streak = 0, res IN resultsAsc | CASE WHEN res IN ["W", "W_AFK"] THEN streak + 1 ELSE 0 END) AS currentStreak
      `, { uid });
    if (result.records.length === 0) return;

    const totalGames = neo4j.integer.toNumber(result.records[0].get("totalGames"));
    const currentStreak = neo4j.integer.toNumber(result.records[0].get("currentStreak"));

    for (const title of crossedTitles(totalGames, GAMES_PLAYED_TITLES)) {
      await awardTitle(uid, title);
    }
    for (const title of crossedTitles(currentStreak, WIN_STREAK_TITLES)) {
      await awardTitle(uid, title);
    }
  } catch (err) {
    console.error("checkAndAwardMatchTitles error:", err);
  }
}

export async function awardTournamentChampionTitle(uid: string): Promise<void> {
  try {
    await awardTitle(uid, TOURNAMENT_CHAMPION_TITLE);
  } catch (err) {
    console.error("awardTournamentChampionTitle error:", err);
  }
}
