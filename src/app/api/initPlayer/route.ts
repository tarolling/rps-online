import { NextRequest, NextResponse } from "next/server";
import { getDriver } from "@/lib/neo4j";
import config from "@/config/settings.json";

export async function POST(req: NextRequest) {
    const { uid, username = "random" } = await req.json();

    if (!uid) {
        return NextResponse.json({ error: "uid is required" }, { status: 400 });
    }

    const driver = getDriver();
    const session = driver.session({ database: "neo4j" });

    try {
        const result = await session.executeWrite(async (tx) => {
            const res = await tx.run(
                `
                MERGE (p:Player {uid: $uid})
                ON CREATE
                    SET p.username = $username,
                        p.rating = $defaultRating,
                        p.created = datetime(),
                        p.lastSeen = datetime()
                ON MATCH
                    SET p.lastSeen = datetime()
                RETURN p.username AS username
                `,
                { uid, username, defaultRating: config.defaultRating }
            );

            if (!res || res.records.length === 0) {
                throw new Error("Unable to modify player.");
            }
            return res.records[0].get("username");
        });

        return NextResponse.json({ username: result });
    } catch (err) {
        console.error("initPlayer error:", err);
        return NextResponse.json({ error: "Failed to process player." }, { status: 500 });
    } finally {
        await session.close();
    }
}