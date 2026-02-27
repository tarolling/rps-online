import { getDriver } from '@/lib/neo4j';
import neo4j from 'neo4j-driver';
import { NextRequest, NextResponse } from 'next/server';


export async function POST(req: NextRequest) {
    const { uid } = await req.json();

    if (!uid) {
        return NextResponse.json({ error: "UID is required." }, { status: 400 });
    }

    const session = getDriver().session({ database: 'neo4j' });

    try {
        const read = await session.executeRead(async tx => {
            const result = await tx.run(`
            MATCH (p:Player {uid: $uid})
            RETURN p.username AS username, p.rating AS rating
            `, { uid });

            if (result?.records.length === 0) {
                throw new Error("No players with the specified user ID exists.");
            }

            return result.records[0];
        });

        return NextResponse.json({
            username: read.get("username"),
            rating: neo4j.integer.toNumber(read.get("rating"))
        });
    } catch (err) {
        console.error("fetchPlayer error:", err);
        return NextResponse.json({ error: "Failed to fetch player." }, { status: 500 });
    } finally {
        await session.close();
    }
}