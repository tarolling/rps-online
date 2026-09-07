import neo4j from "neo4j-driver";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getDriver } from "@/lib/neo4j";
import { Club } from "@/types/neo4j";
import { getAuthedUid } from "@/lib/auth";
import { CreateClubSchema } from "@/lib/schemas/clubs";

/**
 * Search from a list of clubs
 * @param req 
 * @returns 
 */
export async function GET(req: NextRequest) {
  const searchTerm = req.nextUrl.searchParams.get("search") ?? "";

  const session = getDriver().session({ database: process.env.NEO4J_DATABASE });
  try {
    const result = await session.executeRead((tx) =>
      tx.run(`
      MATCH (c:Club)
      WHERE toLower(c.name) CONTAINS toLower($searchTerm)
      WITH c.name AS name, c.tag AS tag, c.availability AS availability
      OPTIONAL MATCH (p:Player)-[:MEMBER]->(:Club {name: name})
      RETURN name, tag, availability, count(p) AS memberCount
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
  const parsed = CreateClubSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body.", details: z.flattenError(parsed.error).fieldErrors },
      { status: 400 },
    );
  }
  const { uid, name, tag, availability } = parsed.data;

  // authenticate so that only the ego user can create their own clubs
  const authedUid = await getAuthedUid(req);
  if (!authedUid || authedUid !== uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = getDriver().session({ database: process.env.NEO4J_DATABASE });
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