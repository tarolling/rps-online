import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import setupAI from '@/lib/aiAlgorithm';
import { Choice, GameState } from '@/types';

const TO_AI: Record<Choice, string> = { [Choice.Rock]: 'R', [Choice.Paper]: 'P', [Choice.Scissors]: 'S' };
const FROM_AI: Record<string, Choice> = { R: Choice.Rock, P: Choice.Paper, S: Choice.Scissors };

export async function POST(req: NextRequest) {
    const { gameId, botId } = await req.json();
    const ai = setupAI();  // note: stateless, no memory between rounds

    const snap = await adminDb.ref(`games/${gameId}`).get();
    const game = snap.val();
    if (!game || game.state !== GameState.InProgress) return NextResponse.json({ done: true });

    const isPlayer1 = game.player1.id === botId;
    const botKey = isPlayer1 ? 'player1' : 'player2';
    const oppKey = isPlayer1 ? 'player2' : 'player1';

    if (game[botKey].submitted) return NextResponse.json({ done: true });

    await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));

    await adminDb.ref(`games/${gameId}/presence/${botId}`).set(true);

    const oppChoice = game[oppKey].choice ? TO_AI[game[oppKey].choice as Choice] : 'R';
    const botChoice = FROM_AI[ai(oppChoice)];

    await adminDb.ref(`games/${gameId}`).update({
        [`${botKey}/choice`]: botChoice,
        [`${botKey}/submitted`]: true,
    });

    return NextResponse.json({ done: true });
}