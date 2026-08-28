import { describe, expect, it } from "vitest";
import { GAMES_PLAYED_TITLES, crossedTitles } from "./titles";

describe("crossedTitles", () => {
  it("returns nothing below the lowest threshold", () => {
    expect(crossedTitles(99, GAMES_PLAYED_TITLES)).toEqual([]);
  });

  it("returns the tier once its threshold is reached", () => {
    expect(crossedTitles(100, GAMES_PLAYED_TITLES).map((t) => t.id)).toEqual(["games_100"]);
  });

  it("returns every tier already qualified for, not just the highest — this is what grandfathers in pre-existing progress", () => {
    expect(crossedTitles(1000, GAMES_PLAYED_TITLES).map((t) => t.id)).toEqual(["games_100", "games_500", "games_1000"]);
  });

  it("includes a tier exactly at its threshold", () => {
    expect(crossedTitles(500, GAMES_PLAYED_TITLES).map((t) => t.id)).toContain("games_500");
  });
});
