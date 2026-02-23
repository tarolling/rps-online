import neo4j from "neo4j-driver";
import { NextRequest, NextResponse } from "next/server";
import { getDriver } from "@/lib/neo4j";
import { Club } from "@/types/neo4j";

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
            case "members": {
                // Returns club info + all members sorted by rating desc
                const result = await session.executeRead((tx) =>
                    tx.run(
                        `MATCH (p:Player)-[r:MEMBER]->(c:Club {name: $clubName})
                        RETURN p.uid AS uid, p.username AS username, p.rating AS rating, r.role AS role
                        ORDER BY p.rating DESC`,
                        { clubName: body.clubName }
                    )
                );
                const clubResult = await session.executeRead((tx) =>
                    tx.run(
                        `MATCH (c:Club {name: $clubName})
                        RETURN c.name AS name, c.tag AS tag, c.availability AS availability`,
                        { clubName: body.clubName }
                    )
                );
                if (clubResult.records.length === 0) {
                    return NextResponse.json({ error: "Club not found." }, { status: 404 });
                }
                const c = clubResult.records[0];
                resultBody = {
                    name: c.get("name"),
                    tag: c.get("tag"),
                    availability: c.get("availability"),
                    members: result.records.map((r) => ({
                        uid: r.get("uid"),
                        username: r.get("username"),
                        rating: neo4j.integer.toNumber(r.get("rating")),
                        role: r.get("role"),
                    })),
                };
                break;
            }
            case "create": {
                let club: Club = {
                    name: body.name,
                    tag: body.tag,
                    availability: body.availability,
                };

                await session.executeWrite((tx) =>
                    tx.run(
                        `MATCH (p:Player {uid: $founderID})
                         CREATE (p)-[:MEMBER {role: 'Founder'}]->(c:Club $club)`,
                        {
                            founderID: body.founderID,
                            club,
                        }
                    )
                );
                break;
            }
            case "join": {
                // can only join if club availability is not closed
                const check = await session.executeRead((tx) =>
                    tx.run(
                        `MATCH (c:Club {name: $clubName})
                        RETURN c.availability AS availability`,
                        { clubName: body.clubName }
                    )
                );
                if (check.records.length === 0 || check.records[0].get("availability") !== "Open") {
                    return NextResponse.json({ error: "Cannot join a closed club." }, { status: 403 });
                }
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
            case "update": {
                // Founder only — update club name, tag, or availability
                // Verify requester is founder first
                const check = await session.executeRead((tx) =>
                    tx.run(
                        `MATCH (p:Player {uid: $uid})-[r:MEMBER]->(c:Club {name: $clubName})
                        RETURN r.role AS role`,
                        { uid: body.uid, clubName: body.clubName }
                    )
                );
                if (check.records.length === 0 || check.records[0].get("role") !== "Founder") {
                    return NextResponse.json({ error: "Only the founder can edit this club." }, { status: 403 });
                }
                await session.executeWrite((tx) =>
                    tx.run(
                        `MATCH (c:Club {name: $clubName})
                        SET c.name = $newName,
                            c.tag = $newTag,
                            c.availability = $availability`,
                        {
                            clubName: body.clubName,
                            newName: body.newName,
                            newTag: body.newTag,
                            availability: body.availability,
                        }
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
            case "removeMember": {
                // Founder only — remove another member
                const check = await session.executeRead((tx) =>
                    tx.run(
                        `MATCH (p:Player {uid: $uid})-[r:MEMBER]->(c:Club {name: $clubName})
                        RETURN r.role AS role`,
                        { uid: body.uid, clubName: body.clubName }
                    )
                );
                if (check.records.length === 0 || check.records[0].get("role") !== "Founder") {
                    return NextResponse.json({ error: "Only the founder can remove members." }, { status: 403 });
                }
                await session.executeWrite((tx) =>
                    tx.run(
                        `MATCH (p:Player {uid: $targetUid})-[r:MEMBER]->(c:Club {name: $clubName})
                        DELETE r`,
                        { targetUid: body.targetUid, clubName: body.clubName }
                    )
                );
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