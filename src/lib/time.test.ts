import { describe, expect, it } from "vitest";
import { formatCountdown } from "./time";

describe("formatCountdown", () => {
  const now = 1_000_000;

  it("reports past due once the target has been reached", () => {
    expect(formatCountdown(now, now)).toBe("past due");
    expect(formatCountdown(now - 1_000, now)).toBe("past due");
  });

  it("formats sub-minute durations in seconds", () => {
    expect(formatCountdown(now + 45_000, now)).toBe("45s");
  });

  it("formats sub-hour durations in minutes", () => {
    expect(formatCountdown(now + 125_000, now)).toBe("2m");
  });

  it("formats sub-day durations in hours and minutes", () => {
    expect(formatCountdown(now + 3_661_000, now)).toBe("1h 1m");
  });

  it("formats multi-day durations in days and hours", () => {
    expect(formatCountdown(now + 90_000_000, now)).toBe("1d 1h");
  });
});
