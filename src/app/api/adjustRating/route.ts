import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/neo4j";
import { isValidPlayMode } from "@/lib/gameModes";

export async function POST(req: NextRequest) {
  const { uid, newRating, mode = "blitz" } = await req.json();

  if (!uid) {
    return NextResponse.json({ error: "UID is required." }, { status: 400 });
  }

  if (!newRating) {
    return NextResponse.json({ error: "Rating is required." }, { status: 400 });
  }

  if (!isValidPlayMode(mode)) {
    return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
  }

  try {
    await runQuery(`
      MATCH (p:Player {uid: $uid})
      MERGE (p)-[:HAS_RATING]->(r:Rating {mode: $mode})
      SET r.value = $newRating
      `, { uid, newRating, mode }, "write");

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("adjustRating error:", err);
    return NextResponse.json({ error: "Failed to adjust rating." }, { status: 500 });
  }
}