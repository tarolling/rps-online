import { adminDb } from '@/lib/firebaseAdmin';

export async function createTournament(
    name: string,
    description: string,
    playerCap: number,
    scheduledStartTime?: number
) {
    const newRef = adminDb.ref('tournaments').push();

    await newRef.set({
        id: crypto.randomUUID(),
        name,
        description,
        status: 'registration',
        playerCap,
        participants: {},
        createdAt: Date.now(),
        scheduledStartTime,
    });
}