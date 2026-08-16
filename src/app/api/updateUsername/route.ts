import { NextRequest, NextResponse } from "next/server";
import { getDriver } from "@/lib/neo4j";
import { getAuthedUid } from "@/lib/auth";
import { Neo4jError } from "neo4j-driver";

export async function POST(req: NextRequest) {
  const { uid, newUsername } = await req.json();

  // authenticate so that only the ego user can update their own username
  const authedUid = await getAuthedUid(req);
  if (!authedUid || authedUid !== uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!uid) {
    return NextResponse.json({ error: "UID is required." }, { status: 400 });
  }

  if (!newUsername) {
    return NextResponse.json({ error: "Username is required." }, { status: 400 });
  }

  const driver = getDriver();
  const session = driver.session({ database: process.env.NEO4J_DATABASE });

  try {
    await session.executeWrite(async (tx) => {
      await tx.run(`
            MATCH (p:Player {uid: $uid})
            SET p.username = $newUsername,
                p.usernameLower = toLower($newUsername)
            `, { uid, newUsername });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("updateUsername error:", err);
    if (err instanceof Neo4jError && err.code === "Neo.ClientError.Schema.ConstraintValidationFailed") {
      return NextResponse.json({ error: "Username is already taken." }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to update username." }, { status: 500 });
  } finally {
    await session.close();
  }
}