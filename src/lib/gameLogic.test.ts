import { describe, expect, it } from "vitest";
import { Game, PlayerState, RoundData } from "@/types";
import { Choice, MatchStatus } from "@/types/neo4j";
import { calculateGameStats, computeRoundOutcome, determineRoundWinner, FIRST_TO } from "./gameLogic";

function buildPlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: "p1",
    username: "player-one",
    score: 0,
    rating: 1000,
    choice: null,
    submitted: false,
    ...overrides,
  };
}

function buildGame(overrides: Partial<Game> = {}): Game {
  return {
    id: "game-1",
    state: MatchStatus.InProgress,
    player1: buildPlayer({ id: "p1", username: "player-one" }),
    player2: buildPlayer({ id: "p2", username: "player-two" }),
    rounds: [],
    currentRound: 0,
    timestamp: 0,
    roundStartTimestamp: 0,
    ...overrides,
  };
}

describe("determineRoundWinner", () => {
  it("returns null when both players chose the same thing", () => {
    expect(determineRoundWinner(Choice.Rock, Choice.Rock)).toBeNull();
    expect(determineRoundWinner(Choice.Paper, Choice.Paper)).toBeNull();
    expect(determineRoundWinner(Choice.Scissors, Choice.Scissors)).toBeNull();
  });

  it("returns null when neither player chose", () => {
    expect(determineRoundWinner(null, null)).toBeNull();
  });

  it("awards the round to whichever player made a choice when the other didn't", () => {
    expect(determineRoundWinner(Choice.Rock, null)).toBe("player1");
    expect(determineRoundWinner(null, Choice.Rock)).toBe("player2");
  });

  it.each([
    [Choice.Rock, Choice.Scissors, "player1"],
    [Choice.Paper, Choice.Rock, "player1"],
    [Choice.Scissors, Choice.Paper, "player1"],
    [Choice.Scissors, Choice.Rock, "player2"],
    [Choice.Rock, Choice.Paper, "player2"],
    [Choice.Paper, Choice.Scissors, "player2"],
  ] as const)("resolves %s vs %s as a win for %s", (choice1, choice2, expected) => {
    expect(determineRoundWinner(choice1, choice2)).toBe(expected);
  });
});

describe("calculateGameStats", () => {
  it("returns all-zero counts when there are no rounds", () => {
    const stats = calculateGameStats(buildGame({ rounds: [] }));
    expect(stats).toEqual({
      playerOneChoices: { ROCK: 0, PAPER: 0, SCISSORS: 0 },
      playerTwoChoices: { ROCK: 0, PAPER: 0, SCISSORS: 0 },
    });
  });

  it("aggregates choice counts per player across rounds, skipping unset choices", () => {
    const rounds: RoundData[] = [
      { player1Choice: Choice.Rock, player2Choice: Choice.Scissors, winner: "player1" },
      { player1Choice: Choice.Rock, player2Choice: Choice.Paper, winner: "player2" },
      { player1Choice: Choice.Paper, player2Choice: null, winner: "player1" },
      { player1Choice: null, player2Choice: null, winner: null },
    ];

    const stats = calculateGameStats(buildGame({ rounds }));
    expect(stats).toEqual({
      playerOneChoices: { ROCK: 2, PAPER: 1, SCISSORS: 0 },
      playerTwoChoices: { ROCK: 0, PAPER: 1, SCISSORS: 1 },
    });
  });
});

describe("computeRoundOutcome", () => {
  it("cancels the round when neither player has submitted", () => {
    const game = buildGame({ roundStartTimestamp: 0 });
    expect(computeRoundOutcome(game, 0).action).toBe("cancel");
  });

  it("does nothing while only one player has submitted and time hasn't expired", () => {
    const game = buildGame({
      roundStartTimestamp: 0,
      player1: buildPlayer({ id: "p1", choice: Choice.Rock, submitted: true }),
      player2: buildPlayer({ id: "p2" }),
    });
    expect(computeRoundOutcome(game, 5_000).action).toBe("noop");
  });

  it("resolves by forfeit once the round timer expires with only one submission", () => {
    const game = buildGame({
      roundStartTimestamp: 0,
      player1: buildPlayer({ id: "p1", choice: Choice.Rock, submitted: true }),
      player2: buildPlayer({ id: "p2" }),
    });
    const outcome = computeRoundOutcome(game, 30_000);
    expect(outcome.action).toBe("resolve");
    expect(outcome.updates?.["player1/score"]).toBe(1);
  });

  it("resolves and increments the round once both players have submitted", () => {
    const game = buildGame({
      currentRound: 2,
      roundStartTimestamp: 0,
      player1: buildPlayer({ id: "p1", score: 1, choice: Choice.Rock, submitted: true }),
      player2: buildPlayer({ id: "p2", score: 0, choice: Choice.Scissors, submitted: true }),
    });
    const outcome = computeRoundOutcome(game, 1_000);

    expect(outcome.action).toBe("resolve");
    expect(outcome.gameOverWinnerId).toBeUndefined();
    expect(outcome.updates).toMatchObject({
      "player1/score": 2,
      "player2/score": 0,
      currentRound: 3,
      roundStartTimestamp: 1_000,
      "rounds/2": {
        player1Choice: Choice.Rock,
        player2Choice: Choice.Scissors,
        winner: "player1",
      },
    });
  });

  it("records a draw round without crediting either player's score", () => {
    const game = buildGame({
      currentRound: 0,
      roundStartTimestamp: 0,
      player1: buildPlayer({ id: "p1", score: 0, choice: Choice.Paper, submitted: true }),
      player2: buildPlayer({ id: "p2", score: 0, choice: Choice.Paper, submitted: true }),
    });
    const outcome = computeRoundOutcome(game, 1_000);

    expect(outcome.updates?.["player1/score"]).toBe(0);
    expect(outcome.updates?.["player2/score"]).toBe(0);
    expect(outcome.updates?.["rounds/0"]).toEqual({
      player1Choice: Choice.Paper,
      player2Choice: Choice.Paper,
      winner: "draw",
    });
  });

  it("ends the game once a player reaches FIRST_TO round wins", () => {
    const game = buildGame({
      currentRound: 3,
      roundStartTimestamp: 0,
      player1: buildPlayer({ id: "p1", score: FIRST_TO - 1, choice: Choice.Rock, submitted: true }),
      player2: buildPlayer({ id: "p2", score: 2, choice: Choice.Scissors, submitted: true }),
    });
    const outcome = computeRoundOutcome(game, 1_000);

    expect(outcome.action).toBe("resolve");
    expect(outcome.gameOverWinnerId).toBe("p1");
    expect(outcome.updates).toMatchObject({
      "player1/score": FIRST_TO,
      state: MatchStatus.Completed,
      winner: "p1",
      endTimestamp: 1_000,
      currentRound: 3,
    });
  });
});
