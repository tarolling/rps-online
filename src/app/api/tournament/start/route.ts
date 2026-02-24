import { startTournament } from '@/lib/tournaments';
import { NextResponse } from 'next/server';

/**
 * Really only here for auto-created tournaments
 * @param req 
 * @returns 
 */
export async function POST(req: Request) {
    // Only callable server-side via cron route, not exposed publicly
    if (req.headers.get('x-internal-secret') !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tournamentId } = await req.json();
    await startTournament(tournamentId);
    return NextResponse.json({ success: true });
}