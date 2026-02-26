import { NextResponse } from 'next/server';
import { createTournament } from '@/lib/tournaments.server';

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: Request) {
    if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scheduledStartTime = Date.now() + 50 * 60 * 1000; // start in 50 minutes
    await createTournament(`Hourly Tournament - ${new Date().toLocaleDateString()}`, 'Automatically scheduled tournament.', 8, scheduledStartTime);
    return NextResponse.json({ success: true });
}