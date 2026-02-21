import neo4j from "neo4j-driver";
import { NextRequest, NextResponse } from "next/server";
import { getDriver } from "@/lib/neo4j";

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { methodType } = body;

    if (!methodType) {
        return NextResponse.json({ error: "Method type is required." }, { status: 400 });
    }

    const driver = getDriver();
    const session = driver.session({ database: "neo4j" });

    try {
        let resultBody: object = { success: true };

        switch (methodType) {
            case "create": {
                await session.executeWrite((tx) =>
                    tx.run(
                        `MATCH (p:Player {uid: $founderID})
                         CREATE (p)-[:MEMBER {role: 'Founder'}]->(c:Club $props)`,
                        {
                            founderID: body.founderID,
                            props: {
                                name: body.name,
                                tag: body.tag,
                                availability: body.availability,
                            },
                        }
                    )
                );
                break;
            }
            case "join": {
                await session.executeWrite((tx) =>
                    tx.run(
                        `MATCH (p:Player {uid: $uid}), (c:Club {name: $clubName})
                         CREATE (p)-[:MEMBER {role: 'Member'}]->(c)`,
                        { uid: body.uid, clubName: body.clubName }
                    )
                );
                break;
            }
            case "leave": {
                await session.executeWrite((tx) =>
                    tx.run(
                        `MATCH (p:Player {uid: $uid})-[r:MEMBER]->(c:Club {name: $clubName})
                         DELETE r`,
                        { uid: body.uid, clubName: body.clubName }
                    )
                );
                break;
            }
            case "search": {
                const result = await session.executeRead((tx) =>
                    tx.run(
                        `MATCH (c:Club)
                         WHERE toLower(c.name) CONTAINS toLower($searchTerm)
                         WITH c.name AS name, c.tag AS tag, c.availability AS availability
                         MATCH (:Player)-[:MEMBER]->(:Club {name: name})
                         RETURN name, tag, availability, count(*) AS memberCount`,
                        { searchTerm: body.searchTerm }
                    )
                );
                resultBody = {
                    clubs: result.records.map((r) => ({
                        name: r.get("name"),
                        tag: r.get("tag"),
                        availability: r.get("availability"),
                        memberCount: neo4j.integer.toNumber(r.get("memberCount")),
                    })),
                };
                break;
            }
            case "user": {
                const result = await session.executeRead((tx) =>
                    tx.run(
                        `MATCH (p:Player {uid: $uid})-[r:MEMBER]->(c:Club)
                         WITH c.name AS name, c.tag AS tag, r.role AS memberRole
                         MATCH (:Player)-[:MEMBER]->(:Club {name: name})
                         RETURN name, tag, memberRole, count(*) AS memberCount`,
                        { uid: body.uid }
                    )
                );
                if (result.records.length === 0) {
                    return NextResponse.json({ error: "Player is not in a club." }, { status: 404 });
                }
                const r = result.records[0];
                resultBody = {
                    name: r.get("name"),
                    tag: r.get("tag"),
                    memberRole: r.get("memberRole"),
                    memberCount: neo4j.integer.toNumber(r.get("memberCount")),
                };
                break;
            }
            default:
                return NextResponse.json({ error: `Unknown methodType: '${methodType}'` }, { status: 400 });
        }

        return NextResponse.json(resultBody);
    } catch (error) {
        console.error("clubs API error:", error);
        return NextResponse.json({ error: "Failed to process request." }, { status: 500 });
    } finally {
        await session.close();
    }
}