import { NextResponse } from 'next/server';
import { clearExpiredTournaments, startScheduledTournaments } from '@/lib/tournaments.server';

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: Request) {
    if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await startScheduledTournaments();
    await clearExpiredTournaments();
    return NextResponse.json({ success: true });
}