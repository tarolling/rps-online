import { NextRequest, NextResponse } from "next/server";
import { getDriver } from "@/lib/neo4j";

export async function POST(req: NextRequest) {
    const { username } = await req.json();

    if (!username) {
        return NextResponse.json({ error: "Username is required." }, { status: 400 });
    }

    const driver = getDriver();
    const session = driver.session({ database: "neo4j" });

    try {
        const read = await session.executeRead(async tx => {
            return await tx.run(`
            MATCH (p:Player)
            WHERE toLower(p.username) = toLower($username)
            RETURN p
            `, { username: username });
        });

        return NextResponse.json({ usernameExists: read.records.length !== 0 });
    } catch (err) {
        console.error("checkUsername error:", err);
        return NextResponse.json({ error: "Failed to check username." }, { status: 500 });
    } finally {
        await session.close();
    }
}