import { NextRequest, NextResponse } from "next/server";
import { getDriver } from "@/lib/neo4j";
import config from "@/config/settings.json";
import { getAuthedUid } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { uid, username = "random" } = await req.json();

  // authenticate so that only the ego user can create their own account
  const authedUid = await getAuthedUid(req);
  if (!authedUid || authedUid !== uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!uid) {
    return NextResponse.json({ error: "uid is required" }, { status: 400 });
  }

  const driver = getDriver();
  const session = driver.session({ database: process.env.NEO4J_DATABASE });

  try {
    const result = await session.executeWrite(async (tx) => {
      const res = await tx.run(
        `
                MERGE (p:Player {uid: $uid})
                ON CREATE
                    SET p.username = $username,
                        p.usernameLower = toLower($username),
                        p.rating = $defaultRating,
                        p.created = datetime(),
                        p.lastSeen = datetime()
                ON MATCH
                    SET p.lastSeen = datetime()
                RETURN p.username AS username
                `,
        { uid, username, defaultRating: config.defaultRating },
      );

      if (!res || res.records.length === 0) {
        throw new Error("Unable to modify player.");
      }
      return res.records[0].get("username");
    });

    return NextResponse.json({ username: result });
  } catch (err: any) {
    console.error("initPlayer error:", err);
    if (err.code === "Neo.ClientError.Schema.ConstraintValidationFailed") {
      return NextResponse.json({ error: "Username is already taken." }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to process player." }, { status: 500 });
  } finally {
    await session.close();
  }
}