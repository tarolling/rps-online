import { describe, expect, it } from "vitest";
import { Participant, Tournament } from "@/types";
import { TournamentMatchStatus } from "@/types/neo4j";
import { generateBracket, getCurrentMatch, seedParticipants } from "./tournamentBracket";

function buildParticipant(overrides: Partial<Participant>): Participant {
  return { id: "p", username: "player", rating: 1000, registered: 0, ...overrides };
}

describe("seedParticipants", () => {
  it("sorts by rating and places seeds on opposite sides of the bracket", () => {
    const participants = [
      buildParticipant({ id: "a", rating: 900 }),
      buildParticipant({ id: "b", rating: 1200 }),
      buildParticipant({ id: "c", rating: 1000 }),
      buildParticipant({ id: "d", rating: 1100 }),
    ];

    const seeded = seedParticipants(participants, 4);

    expect(seeded.map((p) => p?.id)).toEqual(["b", "a", "d", "c"]);
    expect(seeded.map((p) => p?.seed)).toEqual([1, 4, 2, 3]);
  });

  it("leaves a null bye slot when there are fewer participants than bracket size", () => {
    const participants = [
      buildParticipant({ id: "a", rating: 900 }),
      buildParticipant({ id: "b", rating: 1200 }),
      buildParticipant({ id: "c", rating: 1000 }),
    ];

    const seeded = seedParticipants(participants, 4);

    expect(seeded.map((p) => p?.id ?? null)).toEqual(["b", null, "c", "a"]);
  });
});

describe("generateBracket", () => {
  it("auto-advances a bye and seeds round 2 with the bye winner", () => {
    const seeded = [
      buildParticipant({ id: "b", seed: 1 }),
      null,
      buildParticipant({ id: "c", seed: 2 }),
      buildParticipant({ id: "a", seed: 3 }),
    ];

    const bracket = generateBracket(seeded);

    expect(bracket).toHaveLength(3);

    const bye = bracket.find((m) => m.matchId === "round1_match1");
    expect(bye).toMatchObject({
      status: TournamentMatchStatus.Bye,
      winner: seeded[0],
      nextMatchId: "round2_match1",
    });

    const contested = bracket.find((m) => m.matchId === "round1_match2");
    expect(contested).toMatchObject({
      status: TournamentMatchStatus.Waiting,
      player1: seeded[2],
      player2: seeded[3],
      winner: null,
    });

    const roundTwo = bracket.find((m) => m.matchId === "round2_match1");
    expect(roundTwo).toMatchObject({
      round: 2,
      player1: seeded[0],
      player2: null,
      status: TournamentMatchStatus.Waiting,
      nextMatchId: null,
    });
  });

  it("returns a single match for a 2-player bracket with no round 2", () => {
    const seeded = [buildParticipant({ id: "a" }), buildParticipant({ id: "b" })];
    const bracket = generateBracket(seeded);

    expect(bracket).toHaveLength(1);
    expect(bracket[0]).toMatchObject({ round: 1, nextMatchId: null, status: TournamentMatchStatus.Waiting });
  });
});

describe("getCurrentMatch", () => {
  const seeded = [
    buildParticipant({ id: "b", seed: 1 }),
    null,
    buildParticipant({ id: "c", seed: 2 }),
    buildParticipant({ id: "a", seed: 3 }),
  ];
  const bracket = generateBracket(seeded);
  const tournament = { bracket } as unknown as Tournament;

  it("returns null when there is no tournament or bracket", () => {
    expect(getCurrentMatch(null, "a")).toBeNull();
    expect(getCurrentMatch({} as Tournament, "a")).toBeNull();
  });

  it("returns the player's currently waiting match", () => {
    expect(getCurrentMatch(tournament, "a")?.matchId).toBe("round1_match2");
  });

  it("skips matches the player already advanced past via a bye", () => {
    expect(getCurrentMatch(tournament, "b")?.matchId).toBe("round2_match1");
  });

  it("returns null for a player with no active match", () => {
    expect(getCurrentMatch(tournament, "nobody")).toBeNull();
  });
});
