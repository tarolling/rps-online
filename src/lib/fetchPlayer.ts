import neo4j, { Integer } from "neo4j-driver";
import { runQuery } from "@/lib/neo4j";
import config from "@/config/settings.json";
import { PLAY_MODES } from "@/lib/gameModes";
import type { PlayMode, ProfileData } from "@/types";

/**
 * Fetches public profile data for a single player. Shared by the API route
 * and by Server Components that need this data at render time (avoids a
 * self-fetch over HTTP, which breaks under Vercel Deployment Protection on
 * preview builds — see src/lib/matchDetail.ts's getMatchDetail for the same
 * pattern).
 */
export async function getPlayerProfile(uid: string): Promise<ProfileData | null> {
  const result = await runQuery(`
    MATCH (p:Player {uid: $uid})
    OPTIONAL MATCH (p)-[:HAS_RATING]->(r:Rating)
    OPTIONAL MATCH (p)-[:EARNED_TITLE]->(t:Title)
    RETURN p.username AS username, p.isPremium AS isPremium, p.equippedTitleId AS equippedTitleId,
           collect(DISTINCT {mode: r.mode, value: r.value}) AS ratings,
           collect(DISTINCT t.id) AS earnedTitleIds
    `, { uid });

  if (result.records.length === 0) return null;
  const read = result.records[0];

  const ratingsByMode = new Map<string, number>();
  for (const entry of read.get("ratings") as { mode: string | null; value: number | Integer }[]) {
    if (entry.mode !== null) ratingsByMode.set(entry.mode, neo4j.integer.toNumber(entry.value));
  }

  // Players who predate a mode (or haven't been backfilled) fall back to the default rating.
  const ratings = Object.fromEntries(
    PLAY_MODES.map((mode) => [mode, ratingsByMode.get(mode) ?? config.defaultRating]),
  ) as Record<PlayMode, number>;

  const earnedTitleIds = (read.get("earnedTitleIds") as (string | null)[]).filter((id): id is string => id !== null);

  return {
    username: read.get("username"),
    ratings,
    // Boolean only — this is called from public/unauthenticated surfaces, never leak Stripe IDs here.
    isPremium: read.get("isPremium") ?? false,
    equippedTitleId: read.get("equippedTitleId") ?? null,
    earnedTitleIds,
  };
}
