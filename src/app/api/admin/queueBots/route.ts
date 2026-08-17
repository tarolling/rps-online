import { NextResponse, NextRequest } from "next/server";
import { getDriver } from "@/lib/neo4j";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAuthedUid } from "@/lib/auth";
import config from "@/config/settings.json";

export async function POST(req: NextRequest) {
  const authedUid = await getAuthedUid(req);
  if (!authedUid || authedUid !== process.env.ADMIN_UID) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const driver = getDriver();
  const session = driver.session({ database: process.env.NEO4J_DATABASE });

  let records;
  try {
    // Fetch some bots from Neo4j (bots only ever play blitz)
    const result = await session.executeRead((tx) =>
      tx.run(`
        MATCH (p:Player {isBot: true})
        OPTIONAL MATCH (p)-[:HAS_RATING]->(rt:Rating {mode: "blitz"})
        RETURN p.uid AS uid, p.username AS username, coalesce(rt.value, $defaultRating) AS rating LIMIT 100
      `, { defaultRating: config.defaultRating }),
    );
    records = result.records;
  } finally {
    await session.close();
  }

  // atomic read-modify-write so concurrent calls can't double-add the same bot
  // Bots only ever play blitz, so they're always queued under the "blitz" mode key.
  let added = 0;
  await adminDb.ref("matchmaking_queue").transaction((queue) => {
    queue = queue || {};
    added = 0;
    for (const record of records) {
      const uid = record.get("uid");
      const queueKey = `blitz_${uid}`;
      if (!queue[queueKey]) {
        queue[queueKey] = {
          uid,
          username: record.get("username"),
          rating: record.get("rating"),
          mode: "blitz",
          timestamp: Date.now(),
          isBot: true,
        };
        added++;
      }
    }
    return queue;
  });
  

  return NextResponse.json({ added });
}