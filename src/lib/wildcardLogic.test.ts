import { describe, expect, it } from "vitest";
import { Choice } from "@/types/neo4j";
import { determineWildcardRoundWinner } from "./wildcardLogic";

const RPS: [Choice, Choice] = [Choice.Rock, Choice.Paper];
const SPR: [Choice, Choice] = [Choice.Scissors, Choice.Paper];

describe("determineWildcardRoundWinner", () => {
  it("returns null when neither player chose", () => {
    expect(determineWildcardRoundWinner(null, null, undefined, undefined)).toBeNull();
  });

  it("awards the round to whichever player made a choice when the other didn't", () => {
    expect(determineWildcardRoundWinner(Choice.Rock, null, undefined, undefined)).toBe("player1");
    expect(determineWildcardRoundWinner(null, Choice.Rock, undefined, undefined)).toBe("player2");
  });

  it("resolves plain vs plain with standard RPS rules", () => {
    expect(determineWildcardRoundWinner(Choice.Rock, Choice.Scissors, undefined, undefined)).toBe("player1");
    expect(determineWildcardRoundWinner(Choice.Scissors, Choice.Rock, undefined, undefined)).toBe("player2");
    expect(determineWildcardRoundWinner(Choice.Paper, Choice.Paper, undefined, undefined)).toBeNull();
  });

  it("A beats the two plain choices its owner configured", () => {
    // Player1's A beats Rock and Paper — its configured pair.
    expect(determineWildcardRoundWinner(Choice.WildcardA, Choice.Rock, RPS, undefined)).toBe("player1");
    expect(determineWildcardRoundWinner(Choice.WildcardA, Choice.Paper, RPS, undefined)).toBe("player1");
  });

  it("A loses to the one plain choice its owner didn't configure", () => {
    // Player1's A beats Rock/Paper, so it loses to the unconfigured Scissors.
    expect(determineWildcardRoundWinner(Choice.WildcardA, Choice.Scissors, RPS, undefined)).toBe("player2");
  });

  it("works symmetrically when player2 owns the A", () => {
    expect(determineWildcardRoundWinner(Choice.Rock, Choice.WildcardA, undefined, RPS)).toBe("player2");
    expect(determineWildcardRoundWinner(Choice.Scissors, Choice.WildcardA, undefined, RPS)).toBe("player1");
  });

  it("A vs A is always a draw regardless of each player's configured pair", () => {
    expect(determineWildcardRoundWinner(Choice.WildcardA, Choice.WildcardA, RPS, SPR)).toBeNull();
  });

  it("B beats A unconditionally", () => {
    expect(determineWildcardRoundWinner(Choice.WildcardB, Choice.WildcardA, undefined, RPS)).toBe("player1");
    expect(determineWildcardRoundWinner(Choice.WildcardA, Choice.WildcardB, RPS, undefined)).toBe("player2");
  });

  it("B vs B is a draw", () => {
    expect(determineWildcardRoundWinner(Choice.WildcardB, Choice.WildcardB, undefined, undefined)).toBeNull();
  });

  it("B loses to all plain choices unconditionally", () => {
    expect(determineWildcardRoundWinner(Choice.WildcardB, Choice.Rock, undefined, undefined)).toBe("player2");
    expect(determineWildcardRoundWinner(Choice.WildcardB, Choice.Paper, undefined, undefined)).toBe("player2");
    expect(determineWildcardRoundWinner(Choice.WildcardB, Choice.Scissors, undefined, undefined)).toBe("player2");
    expect(determineWildcardRoundWinner(Choice.Rock, Choice.WildcardB, undefined, undefined)).toBe("player1");
  });
});
