import { getAuthedUid } from "@/lib/auth";
import { getDriver } from "@/lib/neo4j";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { JoinClubSchema } from "@/lib/schemas/clubs";

/**
 * Join a club
 * @param req 
 * @param param1 
 * @returns 
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ name: string }>}) {
  const { name: clubName } = await params;
  if (!clubName) {
    return NextResponse.json({ error: "Club name is required." }, { status: 400 });
  }

  const parsed = JoinClubSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body.", details: z.flattenError(parsed.error).fieldErrors },
      { status: 400 },
    );
  }
  const { uid } = parsed.data;

  // authenticate so that only the ego user can join their own club
  const authedUid = await getAuthedUid(req);
  if (!authedUid || authedUid !== uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = getDriver().session({ database: process.env.NEO4J_DATABASE });
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
    const writeResult = await session.executeWrite((tx) =>
      tx.run(`
        MATCH (p:Player {uid: $uid}), (c:Club {name: $clubName})
        CREATE (p)-[:MEMBER {role: 'Member'}]->(c)
        `,
      { uid, clubName },
      ),
    );
    if (writeResult.summary.counters.updates().relationshipsCreated === 0) {
      return NextResponse.json({ error: "Player not found." }, { status: 404 });
    }
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

  // authenticate so that only the ego user can leave their own club
  const authedUid = await getAuthedUid(req);
  if (!authedUid || authedUid !== uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = getDriver().session({ database: process.env.NEO4J_DATABASE });
  try {
    const writeResult = await session.executeWrite((tx) =>
      tx.run(`
        MATCH (p:Player {uid: $uid})-[r:MEMBER]->(c:Club {name: $clubName})
        DELETE r
        `,
      { uid, clubName },
      ),
    );

    if (writeResult.summary.counters.updates().relationshipsDeleted === 0) {
      return NextResponse.json({ error: "Not a member of this club." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Clubs API error:", error);
    return NextResponse.json({ error: "Failed to process request." }, { status: 500 });
  } finally {
    await session.close();
  }
}