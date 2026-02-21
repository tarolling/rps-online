import { NextRequest, NextResponse } from "next/server";
import { getDriver } from "@/lib/neo4j";

export async function POST(req: NextRequest) {
    const { uid, newUsername } = await req.json();

    if (!uid) {
        return NextResponse.json({ error: "UID is required." }, { status: 400 });
    }

    if (!newUsername) {
        return NextResponse.json({ error: "Username is required." }, { status: 400 });
    }

    const driver = getDriver();
    const session = driver.session({ database: "neo4j" });

    try {
        await session.executeWrite(async tx => {
            await tx.run(`
            MATCH (p:Player {uid: $uid})
            SET p.username = $newUsername
            `, { uid, newUsername });
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("updateUsername error:", err);
        return NextResponse.json({ error: "Failed to update username." }, { status: 500 });
    } finally {
        await session.close();
    }
}