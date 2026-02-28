import { getDriver } from "@/lib/neo4j";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Join a club
 * @param req 
 * @param param1 
 * @returns 
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ name: string }>}) {
  const { name: clubName } = await params;
  const { uid } = await req.json();
  if (!uid) {
    return NextResponse.json({ error: "User ID is required." }, { status: 400 });
  }
  if (!clubName) {
    return NextResponse.json({ error: "Club name is required." }, { status: 400 });
  }

  const session = getDriver().session({ database: "neo4j" });
  try {
    // can only join if club availability is not closed
    const check = await session.executeRead((tx) =>
      tx.run(`
        MATCH (c:Club {name: $clubName})
        RETURN c.availability AS availability
        `,
      { clubName },
      ),
    );
    if (check.records.length === 0 || check.records[0].get("availability") !== "Open") {
      return NextResponse.json({ error: "Cannot join a closed club." }, { status: 403 });
    }
    await session.executeWrite((tx) =>
      tx.run(`
        MATCH (p:Player {uid: $uid}), (c:Club {name: $clubName})
        CREATE (p)-[:MEMBER {role: 'Member'}]->(c)
        `,
      { uid, clubName },
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
 * Leave a club
 * @param req 
 * @param param1 
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ name: string }>}) {
  const { name: clubName } = await params;
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) {
    return NextResponse.json({ error: "User ID is required." }, { status: 400 });
  }
  if (!clubName) {
    return NextResponse.json({ error: "Club name is required." }, { status: 400 });
  }

  const session = getDriver().session({ database: "neo4j" });
  try {
    await session.executeWrite((tx) =>
      tx.run(`
        MATCH (p:Player {uid: $uid})-[r:MEMBER]->(c:Club {name: $clubName})
        DELETE r
        `,
      { uid, clubName },
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