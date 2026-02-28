import neo4j from "neo4j-driver";
import { NextRequest, NextResponse } from "next/server";
import { getDriver } from "@/lib/neo4j";
import { Club } from "@/types/neo4j";

/**
 * Search from a list of clubs
 * @param req 
 * @returns 
 */
export async function GET(req: NextRequest) {
  const searchTerm = req.nextUrl.searchParams.get("search") ?? "";

  const session = getDriver().session({ database: "neo4j" });
  try {
    const result = await session.executeRead((tx) =>
      tx.run(`
      MATCH (c:Club)
      WHERE toLower(c.name) CONTAINS toLower($searchTerm)
      WITH c.name AS name, c.tag AS tag, c.availability AS availability
      MATCH (:Player)-[:MEMBER]->(:Club {name: name})
      RETURN name, tag, availability, count(*) AS memberCount
      `,
      { searchTerm },
      ),
    );
    return NextResponse.json( {
      clubs: result.records.map((r) => ({
        name: r.get("name"),
        tag: r.get("tag"),
        availability: r.get("availability"),
        memberCount: neo4j.integer.toNumber(r.get("memberCount")),
      })),
    });
  } catch (error) {
    console.error("Clubs API error:", error);
    return NextResponse.json({ error: "Failed to process request." }, { status: 500 });
  } finally {
    await session.close();
  }
}

/**
 * Create a new club
 * @param req 
 * @returns 
 */
export async function POST(req: NextRequest) {
  const { uid, name, tag, availability } = await req.json();
  if (!uid) {
    return NextResponse.json({ error: "Founder ID is required." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Club name is required." }, { status: 400 });
  }
  if (!tag) {
    return NextResponse.json({ error: "Club tag is required." }, { status: 400 });
  }
  if (!availability) {
    return NextResponse.json({ error: "Club availability is required." }, { status: 400 });
  }

  const session = getDriver().session({ database: "neo4j" });
  try {
    const club: Club = {
      name,
      tag,
      availability,
    };

    await session.executeWrite((tx) =>
      tx.run(`
        MATCH (p:Player {uid: $founderID})
        CREATE (p)-[:MEMBER {role: 'Founder'}]->(c:Club $club)
        `,
      {
        founderID: uid,
        club,
      },
      ),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("clubs API error:", error);
    return NextResponse.json({ error: "Failed to process request." }, { status: 500 });
  } finally {
    await session.close();
  }
}