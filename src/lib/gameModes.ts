import config from "@/config/settings.json";
import type { PlayMode } from "@/types";
import type { GameMode } from "@/types/neo4j";

/**
 * Single source of truth for everything that varies by game mode. Adding a
 * future mode should mean adding one entry here (plus its own game-rule logic,
 * if its rules differ from existing modes) rather than a new ternary arm in
 * every file that currently branches on `mode === "blitz"`/`mode === "async"`.
 */
export interface GameModeDefinition {
  /** Also used directly as the Neo4j `Rating.mode` value — no separate mapping table needed. */
  id: PlayMode;
  /** User-facing name. */
  label: string;
  /** Legacy-named Neo4j `Match.mode` value, e.g. "ranked_wildcard". */
  matchMode: GameMode;
  /** true = synchronous/blocking matchmaking (Blitz, Wildcard); false = queue-and-return (Async). */
  live: boolean;
  roundDurationSeconds: number;
}

export const GAME_MODES: Record<PlayMode, GameModeDefinition> = {
  blitz: {
    id: "blitz",
    label: "Blitz",
    matchMode: "ranked",
    live: true,
    roundDurationSeconds: config.roundTimeout,
  },
  async: {
    id: "async",
    label: "Async",
    matchMode: "ranked_async",
    live: false,
    roundDurationSeconds: config.async.roundTimeoutSeconds,
  },
  wildcard: {
    id: "wildcard",
    label: "Wildcard",
    matchMode: "ranked_wildcard",
    live: true,
    roundDurationSeconds: config.wildcard.roundTimeoutSeconds,
  },
};

export const PLAY_MODES = Object.keys(GAME_MODES) as PlayMode[];

export function isValidPlayMode(mode: unknown): mode is PlayMode {
  return typeof mode === "string" && mode in GAME_MODES;
}

/** Inverse of `GAME_MODES[mode].matchMode` — used to interpret a stored Neo4j `Match.mode` string. */
export function toPlayMode(matchMode: string): PlayMode {
  return PLAY_MODES.find((m) => GAME_MODES[m].matchMode === matchMode) ?? "blitz";
}
