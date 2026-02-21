import { adminAuth } from '@/lib/firebaseAdmin';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
    const session = (await cookies()).get('session')?.value;
    if (!session) return NextResponse.json({ error: 'No session' }, { status: 401 });

    try {
        await adminAuth.verifySessionCookie(session, true);
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }
}