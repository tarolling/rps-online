import { NextRequest, NextResponse } from "next/server";
import { getDriver } from "@/lib/neo4j";

export async function POST(req: NextRequest) {
  const { uid, newRating } = await req.json();

  if (!uid) {
    return NextResponse.json({ error: "UID is required." }, { status: 400 });
  }

  if (!newRating) {
    return NextResponse.json({ error: "Rating is required." }, { status: 400 });
  }

  const session = getDriver().session({ database: "neo4j" });

  try {
    await session.executeWrite(async (tx) => {
      await tx.run(`
                    MATCH (p:Player {uid: $uid})
                    SET p.rating = $newRating
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