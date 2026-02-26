import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { Choice } from '@/lib/common';
import setupAI from '@/lib/aiAlgorithm';
import { Game } from '@/lib/matchmaking.server';

const TO_AI: Record<Choice, string> = { [Choice.Rock]: 'R', [Choice.Paper]: 'P', [Choice.Scissors]: 'S' };
const FROM_AI: Record<string, Choice> = { R: Choice.Rock, P: Choice.Paper, S: Choice.Scissors };

export async function POST(req: NextRequest) {
    const { gameId, botId } = await req.json();
    const ai = setupAI();

    const gameRef = adminDb.ref(`games/${gameId}`);
    await adminDb.ref(`games/${gameId}/presence/${botId}`).set(true);

    const playRound = async (game: Game) => {
        const isPlayer1 = game.player1.id === botId;
        const botKey = isPlayer1 ? 'player1' : 'player2';
        const oppKey = isPlayer1 ? 'player2' : 'player1';

        if (game[botKey].submitted) return;

        await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));

        // Re-fetch to make sure game is still in progress after the delay
        const snap = await gameRef.get();
        const fresh = snap.val();
        if (!fresh || fresh.state !== 'in_progress') return;
        if (fresh[botKey].submitted) return; // someone else may have submitted during delay

        const oppChoice = fresh[oppKey].choice ? TO_AI[fresh[oppKey].choice as Choice] : 'R';
        const botChoice = FROM_AI[ai(oppChoice)];

        await gameRef.update({
            [`${botKey}/choice`]: botChoice,
            [`${botKey}/submitted`]: true,
        });
    };

    return new Promise<NextResponse>((resolve) => {
        gameRef.on('value', async (snap) => {
            const game = snap.val();
            if (!game) return;

            if (game.state !== 'in_progress') {
                if (game.state === 'finished' || game.state === 'cancelled') {
                    gameRef.off('value');
                    adminDb.ref(`matchmaking_queue/${botId}`).remove();
                    resolve(NextResponse.json({ done: true }));
                }
                return;
            }

            const isPlayer1 = game.player1.id === botId;
            const botKey = isPlayer1 ? 'player1' : 'player2';
            if (!game[botKey].submitted) {
                await playRound(game);
            }
        });
    });
}