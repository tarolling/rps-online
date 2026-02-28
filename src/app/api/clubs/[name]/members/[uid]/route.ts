import { getDriver } from "@/lib/neo4j";
import { NextResponse, type NextRequest } from "next/server";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ name: string; uid: string }> }) {
  const { name: clubName, uid: targetUid } = await params; 
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) {
    return NextResponse.json({ error: "Requester ID is required." }, { status: 400 });
  }
  if (!clubName) {
    return NextResponse.json({ error: "Club name is required." }, { status: 400 });
  }
  if (!uid) {
    return NextResponse.json({ error: "Target ID is required." }, { status: 400 });
  }

  const session = getDriver().session({ database: "neo4j" });
  try {
    // Founder only - remove another member
    const check = await session.executeRead((tx) =>
      tx.run(`
        MATCH (p:Player {uid: $uid})-[r:MEMBER]->(c:Club {name: $clubName})
        RETURN r.role AS role
        `,
      { uid, clubName },
      ),
    );
    if (check.records.length === 0 || check.records[0].get("role") !== "Founder") {
      return NextResponse.json({ error: "Only the founder can remove members." }, { status: 403 });
    }
    await session.executeWrite((tx) =>
      tx.run(`
        MATCH (p:Player {uid: $targetUid})-[r:MEMBER]->(c:Club {name: $clubName})
        DELETE r
        `,
      { targetUid, clubName },
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