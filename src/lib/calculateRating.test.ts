import { describe, expect, it } from "vitest";
import calculateRating from "./calculateRating";

describe("calculateRating", () => {
  it("gives equal-rated players a symmetric swing on a win", () => {
    const newRating = calculateRating(1000, 1000, true);
    expect(newRating).toBe(1023);
  });

  it("gives equal-rated players a symmetric swing on a loss", () => {
    const newRating = calculateRating(1000, 1000, false);
    expect(newRating).toBe(978);
  });

  it("awards a small gain when the favorite beats a much weaker opponent", () => {
    const newRating = calculateRating(1800, 1000, true);
    expect(newRating).toBeGreaterThan(1800);
    expect(newRating - 1800).toBeLessThan(10);
  });

  it("awards a large gain when the underdog upsets a much stronger opponent", () => {
    const newRating = calculateRating(1000, 1800, true);
    expect(newRating - 1000).toBeGreaterThan(40);
  });

  it("penalizes the favorite heavily for losing to a much weaker opponent", () => {
    const newRating = calculateRating(1800, 1000, false);
    expect(1800 - newRating).toBeGreaterThan(40);
  });

  it("clamps the new rating at the maximum of 5000", () => {
    const newRating = calculateRating(4980, 10_000_000, true);
    expect(newRating).toBe(5000);
  });

  it("clamps the new rating at the minimum of 0", () => {
    const newRating = calculateRating(5, 5, false);
    expect(newRating).toBe(0);
  });

  it("returns the unchanged rating when the exponent calculation overflows to a non-finite result", () => {
    const newRating = calculateRating(10_000_000_000, 10_000_000_000, true);
    expect(newRating).toBe(10_000_000_000);
  });
});
