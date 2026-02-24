import { getDatabase, ref, get } from 'firebase/database';
import { startTournament } from '@/lib/tournaments';
import { NextResponse } from 'next/server';
import { Tournament } from '@/types/tournament';

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: Request) {
    if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDatabase();
    const snapshot = await get(ref(db, 'tournaments'));
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