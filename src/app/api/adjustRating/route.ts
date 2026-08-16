import { NextRequest, NextResponse } from "next/server";
import { getDriver } from "@/lib/neo4j";
import type { PlayMode } from "@/types";

export async function POST(req: NextRequest) {
  const { uid, newRating, mode = "blitz" } = await req.json();

  if (!uid) {
    return NextResponse.json({ error: "UID is required." }, { status: 400 });
  }

  if (!newRating) {
    return NextResponse.json({ error: "Rating is required." }, { status: 400 });
  }

  if (mode !== "blitz" && mode !== "async") {
    return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
  }
  const ratingField = (mode as PlayMode) === "async" ? "asyncRating" : "rating";

  const session = getDriver().session({ database: process.env.NEO4J_DATABASE });

  try {
    await session.executeWrite(async (tx) => {
      await tx.run(`
                    MATCH (p:Player {uid: $uid})
                    SET p.${ratingField} = $newRating
                    `, { uid, newRating });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("adjustRating error:", err);
    return NextResponse.json({ error: "Failed to adjust rating." }, { status: 500 });
  } finally {
    await session.close();
  }
}