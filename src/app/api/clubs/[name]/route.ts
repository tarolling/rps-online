import { getDriver } from "@/lib/neo4j";
import { NextResponse, type NextRequest } from "next/server";
import neo4j from "neo4j-driver";

/**
 * Get club members/info 
 * @param _req 
 * @param param1 
 * @returns 
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }>}) {
  const { name: clubName } = await params;
  if (!clubName) {
    return NextResponse.json({ error: "Club name is required." }, { status: 400 });
  }

  const session = getDriver().session({ database: "neo4j" });
  try {
    // Returns club info + all members sorted by rating desc
    const result = await session.executeRead((tx) =>
      tx.run(`
        MATCH (p:Player)-[r:MEMBER]->(c:Club {name: $clubName})
        RETURN p.uid AS uid, p.username AS username, p.rating AS rating, r.role AS role
        ORDER BY p.rating DESC
        `,
      { clubName },
      ),
    );
    const clubResult = await session.executeRead((tx) =>
      tx.run(`
        MATCH (c:Club {name: $clubName})
        RETURN c.name AS name, c.tag AS tag, c.availability AS availability
        `,
      { clubName },
      ),
    );
    if (clubResult.records.length === 0) {
      return NextResponse.json({ error: "Club not found." }, { status: 404 });
    }
    
    const c = clubResult.records[0];
    return NextResponse.json({
      name: c.get("name"),
      tag: c.get("tag"),
      availability: c.get("availability"),
      members: result.records.map((r) => ({
        uid: r.get("uid"),
        username: r.get("username"),
        rating: neo4j.integer.toNumber(r.get("rating")),
        role: r.get("role"),
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
 * Edit a club's information; only founders can edit their own club
 * @param req 
 * @param param1 
 * @returns 
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ name: string }>}) {
  const { name: clubName } = await params;
  const {        
    uid,
    newName,
    newTag,
    availability,
  } = await req.json();
  if (!clubName) {
    return NextResponse.json({ error: "Club name is required." }, { status: 400 });
  }
  if (!uid) {
    return NextResponse.json({ error: "User ID is required." }, { status: 400 });
  }

  const session = getDriver().session({ database: "neo4j" });
  try {
    // Founder only - update club name, tag, or availability
    // Verify requester is founder first
    const check = await session.executeRead((tx) =>
      tx.run(`
      MATCH (p:Player {uid: $uid})-[r:MEMBER]->(c:Club {name: $clubName})
      RETURN r.role AS role
      `,
      { uid, clubName },
      ),
    );
    if (check.records.length === 0 || check.records[0].get("role") !== "Founder") {
      return NextResponse.json({ error: "Only the founder can edit this club." }, { status: 403 });
    }
    await session.executeWrite((tx) =>
      tx.run(`
        MATCH (c:Club {name: $clubName})
        SET c.name = $newName,
        c.tag = $newTag,
        c.availability = $availability
        `,
      {
        clubName,
        newName,
        newTag,
        availability,
      },
      ),
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Clubs API error:", error);
    return NextResponse.json({ error: "Failed to process request." }, { status: 500 });
  } finally {
    await session.close();
  }
}

/**
 * Delete a club (if no members)
 * @param req 
 * @param param1 
 * @returns 
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ name: string }>}) {
  const { name: clubName } = await params;
  if (!clubName) {
    return NextResponse.json({ error: "Club name is required." }, { status: 400 });
  }

  const session = getDriver().session({ database: "neo4j" });
  try {
    await session.executeWrite((tx) =>
      tx.run(`
        MATCH (c:Club {name: $clubName})
        DETACH DELETE c
        `,
      { clubName },
      ),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Clubs API error:", error);
    return NextResponse.json({ error: "Failed to process request." }, { status: 500 });
  } finally {
    await session.close();
  }
}