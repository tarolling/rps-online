import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from 'firebase-admin/database';
import { Choice } from '@/lib/common';
import setupAI from '@/lib/aiAlgorithm';

const TO_AI: Record<Choice, string> = { [Choice.Rock]: 'R', [Choice.Paper]: 'P', [Choice.Scissors]: 'S' };
const FROM_AI: Record<string, Choice> = { R: Choice.Rock, P: Choice.Paper, S: Choice.Scissors };

export async function POST(req: NextRequest) {
    const { gameId, botId } = await req.json();
    const db = getDatabase();
    const ai = setupAI();

    const gameRef = db.ref(`games/${gameId}`);
    let round = 1;

    // Poll for the bot's turn each round
    const playRound = async () => {
        const snap = await gameRef.get();
        const game = snap.val();
        if (!game || game.state !== 'in_progress') return;

        const isPlayer1 = game.player1.id === botId;
        const botKey = isPlayer1 ? 'player1' : 'player2';
        const oppKey = isPlayer1 ? 'player2' : 'player1';

        if (game[botKey].submitted) return; // already submitted this round

        // Small random delay so it doesn't feel instant
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));

        const oppChoice = game[oppKey].choice ? TO_AI[game[oppKey].choice as Choice] : 'R';
        const botChoice = FROM_AI[ai(oppChoice)];

        await gameRef.update({
            [`${botKey}/choice`]: botChoice,
            [`${botKey}/submitted`]: true,
        });
    };

    // Watch the game and play each round
    return new Promise<NextResponse>((resolve) => {
        gameRef.on('value', async (snap) => {
            const game = snap.val();
            if (!game || game.state !== 'in_progress') {
                gameRef.off('value');
                // Clean up bot from queue
                db.ref(`matchmaking_queue/${botId}`).remove();
                resolve(NextResponse.json({ done: true }));
                return;
            }
            if (game.currentRound !== round) {
                round = game.currentRound;
                await playRound();
            }
        });
        playRound(); // play round 1 immediately
    });
}