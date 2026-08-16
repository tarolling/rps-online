import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/neo4j";
import config from "@/config/settings.json";
import { getAuthedUid } from "@/lib/auth";
import { Neo4jError } from "neo4j-driver";

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

  try {
    const res = await runQuery(
      `
      MERGE (p:Player {uid: $uid})
      ON CREATE
          SET p.username = $username,
              p.usernameLower = toLower($username),
              p.rating = $defaultRating,
              p.asyncRating = $defaultRating,
              p.created = datetime(),
              p.lastSeen = datetime()
      ON MATCH
          SET p.lastSeen = datetime()
      RETURN p.username AS username
      `,
      { uid, username, defaultRating: config.defaultRating },
      "write",
    );

    if (res.records.length === 0) {
      throw new Error("Unable to modify player.");
    }

    return NextResponse.json({ username: res.records[0].get("username") });
  } catch (err) {
    console.error("initPlayer error:", err);
    if (err instanceof Neo4jError && err.code === "Neo.ClientError.Schema.ConstraintValidationFailed") {
      return NextResponse.json({ error: "Username is already taken." }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to process player." }, { status: 500 });
  }
}