import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getDriver } from "@/lib/neo4j";

type Action = "send" | "accept" | "reject" | "remove" | "cancel";

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

  const session = getDriver().session({ database: "neo4j" });
  try {
    const result = await session.executeRead((tx) =>
      tx.run(
        `MATCH (p:Player {uid: $uid})-[r:FRIENDS_WITH]->(f:Player)
         RETURN f.uid AS uid, f.username AS username, r.since AS since`,
        { uid },
      ),
    );
    const friends = result.records.map((rec) => ({
      uid: rec.get("uid"),
      username: rec.get("username"),
      since: rec.get("since"),
    }));
    return NextResponse.json({ friends });
  } finally {
    await session.close();
  }
}

export async function POST(req: NextRequest) {
  const { action, myId, myUsername, otherId, otherUsername } = await req.json() as {
    action: Action;
    myId: string;
    myUsername: string;
    otherId: string;
    otherUsername?: string;
  };

  if (!action || !myId || !otherId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  switch (action) {
  case "send": {
    const now = Date.now();
    await Promise.all([
      adminDb.ref(`friends/${myId}/outgoing/${otherId}`).set({ username: otherUsername ?? "", sentAt: now }),
      adminDb.ref(`friends/${otherId}/incoming/${myId}`).set({ username: myUsername, sentAt: now }),
    ]);
    break;
  }

  case "accept": {
    const inSnap = await adminDb.ref(`friends/${myId}/incoming/${otherId}`).get();
    if (!inSnap.exists()) return NextResponse.json({ error: "No pending request" }, { status: 400 });

    const fromUsername = inSnap.val()?.username ?? otherUsername ?? "";
    const since = Date.now();

    const session = getDriver().session({ database: "neo4j" });
    try {
      await session.executeWrite((tx) =>
        tx.run(
          `MATCH (a:Player {uid: $myId}), (b:Player {uid: $otherId})
             MERGE (a)-[:FRIENDS_WITH {since: $since}]->(b)
             MERGE (b)-[:FRIENDS_WITH {since: $since}]->(a)`,
          { myId, otherId, since },
        ),
      );
    } finally {
      await session.close();
    }

    await Promise.all([
      adminDb.ref(`friends/${myId}/incoming/${otherId}`).remove(),
      adminDb.ref(`friends/${otherId}/outgoing/${myId}`).remove(),
    ]);

    void fromUsername;
    break;
  }

  case "reject":
    await Promise.all([
      adminDb.ref(`friends/${myId}/incoming/${otherId}`).remove(),
      adminDb.ref(`friends/${otherId}/outgoing/${myId}`).remove(),
    ]);
    break;

  case "remove": {
    const session = getDriver().session({ database: "neo4j" });
    try {
      await session.executeWrite((tx) =>
        tx.run(
          `MATCH (a:Player {uid: $myId})-[r:FRIENDS_WITH]-(b:Player {uid: $otherId})
             DELETE r`,
          { myId, otherId },
        ),
      );
    } finally {
      await session.close();
    }
    break;
  }

  case "cancel":
    await Promise.all([
      adminDb.ref(`friends/${myId}/outgoing/${otherId}`).remove(),
      adminDb.ref(`friends/${otherId}/incoming/${myId}`).remove(),
    ]);
    break;

  default:
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}