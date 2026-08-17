import { Choice } from "@/types/neo4j";

const PLAIN_CHOICES = [Choice.Rock, Choice.Paper, Choice.Scissors];
const PLAIN_BEATS: Partial<Record<Choice, Choice>> = {
  [Choice.Rock]: Choice.Scissors,
  [Choice.Paper]: Choice.Rock,
  [Choice.Scissors]: Choice.Paper,
};

function isPlain(c: Choice): boolean {
  return (PLAIN_CHOICES as Choice[]).includes(c);
}

/**
 * Determines the winner of a single Wildcard round. Unlike `determineRoundWinner`,
 * this needs each acting player's own pregame `aBeats` config to interpret any
 * round involving that player's Wildcard-A, because A's win/loss profile is
 * chosen by its owner before the match (the two plain choices in `aBeats1`/
 * `aBeats2` are what that player's own A beats; the third, unpicked one beats it).
 *
 * Rules: A beats its owner's 2 configured plain choices, ties itself, loses to
 * the 1 unconfigured plain choice and to B. B beats only A, ties itself, loses
 * to all plain choices unconditionally. Plain vs plain is standard RPS.
 */
export function determineWildcardRoundWinner(
  choice1: Choice | null,
  choice2: Choice | null,
  aBeats1: [Choice, Choice] | undefined,
  aBeats2: [Choice, Choice] | undefined,
): "player1" | "player2" | null {
  if (choice1 === null && choice2 === null) return null;
  if (!choice1) return "player2";
  if (!choice2) return "player1";
  if (choice1 === choice2) return null; // covers A-vs-A and B-vs-B ties too

  if (isPlain(choice1) && isPlain(choice2)) {
    return PLAIN_BEATS[choice1] === choice2 ? "player1" : "player2";
  }

  if (choice1 === Choice.WildcardB) return choice2 === Choice.WildcardA ? "player1" : "player2";
  if (choice2 === Choice.WildcardB) return choice1 === Choice.WildcardA ? "player2" : "player1";

  if (choice1 === Choice.WildcardA && isPlain(choice2)) {
    return aBeats1?.includes(choice2) ? "player1" : "player2";
  }
  if (choice2 === Choice.WildcardA && isPlain(choice1)) {
    return aBeats2?.includes(choice1) ? "player2" : "player1";
  }

  return null; // unreachable
}
