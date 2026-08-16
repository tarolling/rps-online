import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { Choice, MatchStatus } from "@/types/neo4j";
import type { Game, RoundData } from "@/types";
import { getRankTierIndex } from "@/lib/ranks";

const COUNTER: Record<Choice, Choice> = {
  [Choice.Rock]: Choice.Paper,
  [Choice.Paper]: Choice.Scissors,
  [Choice.Scissors]: Choice.Rock,
};

// game.rounds is stored in Firebase as an object keyed by round number, not a real array
function toRoundsArray(rounds: Record<string, RoundData> | RoundData[]): RoundData[] {
  return Array.isArray(rounds)
    ? rounds
    : Object.keys(rounds)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => rounds[k]);
}

function getBotChoice(round: number, botStrength: number, oppLastChoice?: Choice): Choice {
  const rng = [Choice.Rock, Choice.Paper, Choice.Scissors];
  if (round <= botStrength || !oppLastChoice) return rng[Math.floor(Math.random() * 3)];
  return COUNTER[oppLastChoice];
}

export async function POST(req: NextRequest) {
  const { gameId, botId } = await req.json();

  const snap = await adminDb.ref(`games/${gameId}`).get();
  const game: Game = snap.val();
  if (!game || game.state !== MatchStatus.InProgress) return NextResponse.json({ done: true });
  
  const isPlayer1 = game.player1.id === botId;
  const botKey = isPlayer1 ? "player1" : "player2";
  
  if (game[botKey].submitted) return NextResponse.json({ done: true });
  
  // add slight delay
  await new Promise((r) => setTimeout(r, 1000 + Math.random() * 3000));
  
  // set presence so match doesn't timeout
  await adminDb.ref(`games/${gameId}/presence/${botId}`).set(true);
  
  const round = game.currentRound;
  const botStrength = Math.floor(getRankTierIndex(game[botKey].rating) / 3) * 2;
  const lookback = getRankTierIndex(game[botKey].rating) % 3;
  const roundsArr = toRoundsArray(game.rounds);
  const oppLastChoice = round === 1 ? Choice.Paper : isPlayer1 ? roundsArr.at(-lookback - 1)?.player2Choice : roundsArr.at(-lookback - 1)?.player1Choice;
  const botChoice = getBotChoice(round, botStrength, oppLastChoice!);

  await adminDb.ref(`games/${gameId}`).update({
    [`${botKey}/choice`]: botChoice,
    [`${botKey}/submitted`]: true,
  });

  return NextResponse.json({ done: true });
}