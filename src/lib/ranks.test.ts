import { describe, expect, it } from "vitest";
import {
  getDivisionLabel,
  getRankNames,
  getRankRatingRange,
  getRankTier,
  getRankTierIndex,
} from "./ranks";

describe("getRankTier", () => {
  it("returns the base Recruit tier for a rating of 0", () => {
    expect(getRankTier(0)).toMatchObject({ rank: "Recruit", division: 1 });
  });

  it("stays in the lower division just below a threshold", () => {
    expect(getRankTier(299)).toMatchObject({ rank: "Recruit", division: 3 });
  });

  it("advances to the next division exactly at its threshold", () => {
    expect(getRankTier(300)).toMatchObject({ rank: "Apprentice", division: 1 });
  });

  it("returns the Infinity tier for any rating at or above 2100", () => {
    expect(getRankTier(2100)).toMatchObject({ rank: "Infinity", division: null });
    expect(getRankTier(999_999)).toMatchObject({ rank: "Infinity", division: null });
  });
});

describe("getRankTierIndex", () => {
  it("returns 0 for the lowest tier", () => {
    expect(getRankTierIndex(0)).toBe(0);
  });

  it("returns the last index for the Infinity tier", () => {
    expect(getRankTierIndex(2100)).toBe(21);
  });
});

describe("getRankRatingRange", () => {
  it("covers all three divisions of a rank up to the next rank's start", () => {
    expect(getRankRatingRange("Recruit")).toEqual([0, 300]);
    expect(getRankRatingRange("Apprentice")).toEqual([300, 600]);
  });

  it("is open-ended for the top rank", () => {
    expect(getRankRatingRange("Infinity")).toEqual([2100, Infinity]);
  });
});

describe("getDivisionLabel", () => {
  it("maps divisions to roman numerals", () => {
    expect(getDivisionLabel(1)).toBe("I");
    expect(getDivisionLabel(2)).toBe("II");
    expect(getDivisionLabel(3)).toBe("III");
  });

  it("returns an empty string for the divisionless Infinity rank", () => {
    expect(getDivisionLabel(null)).toBe("");
  });
});

describe("getRankNames", () => {
  it("returns each rank name once, in ascending rating order", () => {
    expect(getRankNames()).toEqual([
      "Recruit", "Apprentice", "Veteran", "Expert",
      "Master", "Grandmaster", "Ultimate", "Infinity",
    ]);
  });
});
