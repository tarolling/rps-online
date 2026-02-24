import { adminDb } from '@/lib/firebaseAdmin';
import { NextResponse } from 'next/server';


export async function POST(req: Request) {
    if (req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scheduledStartTime = Date.now() + 60 * 60 * 1000; // start in 30 minutes

    await adminDb.ref('tournaments').push({
        id: crypto.randomUUID(),
        name: `Hourly Tournament - ${new Date().toLocaleDateString()}`,
        description: 'Automatically scheduled hourly tournament.',
        playerCap: 8,
        status: 'registration',
        createdAt: Date.now(),
        scheduledStartTime,
        autoCreated: true,
        participants: {},
    });

    return NextResponse.json({ success: true });
}