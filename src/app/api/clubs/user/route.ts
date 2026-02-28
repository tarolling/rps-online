import neo4j from "neo4j-driver";
import { getDriver } from "@/lib/neo4j";
import { NextRequest, NextResponse } from "next/server";

/**
 * Gets a user's club
 * @param req 
 * @returns 
 */
export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) {
    return NextResponse.json({ error: "User ID is required." }, { status: 400 });
  }
  const session = getDriver().session({ database: "neo4j" });

  try {
    const result = await session.executeRead((tx) =>
      tx.run(`
        MATCH (p:Player {uid: $uid})-[r:MEMBER]->(c:Club)
        WITH c.name AS name, c.tag AS tag, c.availability AS availability, r.role AS memberRole
        MATCH (:Player)-[:MEMBER]->(:Club {name: name})
        RETURN name, tag, availability, memberRole, count(*) AS memberCount
        `,
      { uid },
      ),
    );
    if (result.records.length === 0) {
      return NextResponse.json(null, { status: 200 });
    }
    const r = result.records[0];

    return NextResponse.json({
      name: r.get("name"),
      tag: r.get("tag"),
      availability: r.get("availability"),
      memberRole: r.get("memberRole"),
      memberCount: neo4j.integer.toNumber(r.get("memberCount")),
    });
  } catch (error) {
    console.error("Clubs API error:", error);
    return NextResponse.json({ error: "Failed to process request." }, { status: 500 });
  } finally {
    await session.close();
  }
}