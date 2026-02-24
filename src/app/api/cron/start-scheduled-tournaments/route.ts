import '@/lib/firebaseAdmin';
import { NextResponse } from 'next/server';
import { Tournament } from '@/types/tournament';
import { adminDb } from '@/lib/firebaseAdmin';


export async function POST(req: Request) {
    if (req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
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

    // Call the internal start route for each, so startTournament runs in a
    // context where the client Firebase SDK is initialized
    await Promise.all(toStart.map(([id]) =>
        fetch(new URL('/api/tournament/start', process.env.NEXT_PUBLIC_APP_URL).toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-secret': process.env.CRON_SECRET!,
            },
            body: JSON.stringify({ tournamentId: id }),
        })
    ));

    return NextResponse.json({ started: toStart.map(([id]) => id) });
}