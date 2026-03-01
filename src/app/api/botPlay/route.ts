import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { Choice, MatchStatus } from "@/types/neo4j";
import type { Game } from "@/types";


function getCyclicChoice(round: number, offset = 2, cycleLength = 5): Choice {
  const cycle: Choice[] = [Choice.Rock, Choice.Paper, Choice.Scissors];
  return cycle[(round + offset) % cycleLength];
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
  const botChoice = getCyclicChoice(round, round === 1 ? Math.floor(Math.random() * 3) : round, round);

  await adminDb.ref(`games/${gameId}`).update({
    [`${botKey}/choice`]: botChoice,
    [`${botKey}/submitted`]: true,
  });

  return NextResponse.json({ done: true });
}