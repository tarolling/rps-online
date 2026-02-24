import { getDatabase, push, ref, set } from 'firebase/database';
import { NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: Request) {
    if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDatabase();
    const scheduledStartTime = Date.now() + 55 * 60 * 1000; // start in 55 minutes

    const newRef = push(ref(db, 'tournaments'));
    await set(newRef, {
        id: crypto.randomUUID(),
        name: `Daily Tournament - ${new Date().toLocaleDateString()}`,
        description: 'Automatically scheduled daily tournament.',
        playerCap: 8,
        status: 'registration',
        createdAt: Date.now(),
        scheduledStartTime,
        autoCreated: true,
        participants: {},
    });

    return NextResponse.json({ success: true });
}