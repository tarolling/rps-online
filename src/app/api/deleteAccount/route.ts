import { NextRequest, NextResponse } from "next/server";
import { getDriver } from "@/lib/neo4j";
import { getAuthedUid } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { uid } = await req.json();

  // authenticate so that only the ego user can delete their own account
  const authedUid = await getAuthedUid(req);
  if (!authedUid || authedUid !== uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!uid) {
    return NextResponse.json({ error: "UID is required." }, { status: 400 });
  }

  const driver = getDriver();
  const session = driver.session({ database: process.env.NEO4J_DATABASE });

  try {
    await session.executeWrite(async (tx) => {
      await tx.run(`
            MATCH (p:Player {uid: $uid})
            DETACH DELETE p
            `, { uid });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("deleteAccount error:", err);
    return NextResponse.json({ error: "Failed to delete account." });
  } finally {
    await session.close();
  }
}