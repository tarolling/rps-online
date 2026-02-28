import { NextResponse } from "next/server";
import { getDriver } from "@/lib/neo4j";
import { adminDb } from "@/lib/firebaseAdmin";

export async function POST() {
  const driver = getDriver();
  const session = driver.session({ database: "neo4j" });

  // Fetch some bots from Neo4j
  const result = await session.executeRead((tx) =>
    tx.run("MATCH (p:Player {isBot: true}) RETURN p.uid AS uid, p.username AS username, p.rating AS rating LIMIT 10"),
  );
  await session.close();

  const queueSnap = await adminDb.ref("matchmaking_queue").get();
  const queue = queueSnap.val() || {};

  for (const record of result.records) {
    const uid = record.get("uid");
    if (!queue[uid]) { // don't double-add
      await adminDb.ref(`matchmaking_queue/${uid}`).set({
        username: record.get("username"),
        rating: record.get("rating"),
        timestamp: Date.now(),
        isBot: true,
      });
    }
  }

  return NextResponse.json({ added: result.records.length });
}