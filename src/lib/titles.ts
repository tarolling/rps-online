import type { TitleRarity } from "@/types/neo4j";

/**
 * Single source of truth for every awardable title: display metadata plus
 * (for auto-awarded titles) the threshold that triggers it. Neo4j only ever
 * stores the id on the relationship/node — this catalog is what renders it,
 * same pattern as GAME_MODES for game modes and RANK_TIERS for ranks.
 */
export interface TitleDefinition {
  id: string;
  name: string;
  description: string;
  rarity: TitleRarity;
}

export const RARITY_COLOR: Record<TitleRarity, string> = {
  common: "#8b9099",
  rare: "#3498db",
  epic: "#9b59b6",
  legendary: "#f1c40f",
};

/** Lifetime games-played milestones, checked across all modes combined. */
export const GAMES_PLAYED_TITLES: { threshold: number; title: TitleDefinition }[] = [
  { threshold: 100, title: { id: "games_100", name: "Centurion", description: "Played 100 games.", rarity: "common" } },
  { threshold: 500, title: { id: "games_500", name: "Veteran Grinder", description: "Played 500 games.", rarity: "rare" } },
  { threshold: 1000, title: { id: "games_1000", name: "Iron Will", description: "Played 1,000 games.", rarity: "epic" } },
];

/** Win-streak milestones, checked across all modes combined. */
export const WIN_STREAK_TITLES: { threshold: number; title: TitleDefinition }[] = [
  { threshold: 10, title: { id: "streak_10", name: "On Fire", description: "Won 10 games in a row.", rarity: "rare" } },
  { threshold: 25, title: { id: "streak_25", name: "Unstoppable", description: "Won 25 games in a row.", rarity: "epic" } },
  { threshold: 50, title: { id: "streak_50", name: "Untouchable", description: "Won 50 games in a row.", rarity: "legendary" } },
];

export const INFINITY_RANK_TITLE: TitleDefinition = {
  id: "rank_infinity",
  name: "Infinite",
  description: "Reached Infinity rank.",
  rarity: "legendary",
};

export const TOURNAMENT_CHAMPION_TITLE: TitleDefinition = {
  id: "tournament_champion",
  name: "Tournament Champion",
  description: "Won a tournament.",
  rarity: "epic",
};

export const TITLES: Record<string, TitleDefinition> = Object.fromEntries(
  [
    ...GAMES_PLAYED_TITLES.map((t) => t.title),
    ...WIN_STREAK_TITLES.map((t) => t.title),
    INFINITY_RANK_TITLE,
    TOURNAMENT_CHAMPION_TITLE,
  ].map((t) => [t.id, t]),
);

export function getTitle(id: string): TitleDefinition | null {
  return TITLES[id] ?? null;
}

/**
 * Every tier definition a `current` count qualifies for. Deliberately not
 * "newly crossed since some previous value" — awarding is idempotent (MERGE),
 * so re-checking a tier someone already has is a harmless no-op, and checking
 * unconditionally against the live count is what makes a player who already
 * had, say, a 15-win streak before this title existed get grandfathered in
 * the next time their streak is checked, instead of needing to hit exactly 10
 * again from a fresh climb.
 */
export function crossedTitles(
  current: number,
  tiers: { threshold: number; title: TitleDefinition }[],
): TitleDefinition[] {
  return tiers.filter((t) => current >= t.threshold).map((t) => t.title);
}
