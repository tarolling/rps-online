import { NextResponse } from 'next/server';
import { Tournament } from '@/types/tournament';
import { startTournament } from '@/lib/tournaments.server';
import { adminDb } from '@/lib/firebaseAdmin';


const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: Request) {
    if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const snapshot = await adminDb.ref('tournaments').get();
    const tournaments: Record<string, Tournament> = snapshot.val() ?? {};
    const now = Date.now();

    const toStart = Object.entries(tournaments).filter(([, t]) =>
        t.status === 'registration' &&
        t.scheduledStartTime &&
        t.scheduledStartTime <= now &&
        Object.keys(t.participants ?? {}).length >= 2
    );

    await Promise.all(toStart.map(([id]) => startTournament(id)));

    return NextResponse.json({ started: toStart.map(([id]) => id) });
}