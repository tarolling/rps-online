import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/neo4j";
import config from "@/config/settings.json";
import { getAuthedUid } from "@/lib/auth";
import { Neo4jError } from "neo4j-driver";
import { PLAY_MODES } from "@/lib/gameModes";

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
              p.created = datetime(),
              p.lastSeen = datetime(),
              p.isPremium = false
      ON MATCH
          SET p.lastSeen = datetime()
      WITH p
      UNWIND $modes AS mode
      MERGE (p)-[:HAS_RATING]->(r:Rating {mode: mode})
      ON CREATE SET r.value = $defaultRating
      WITH p, count(r) AS ratingsEnsured
      RETURN p.username AS username
      `,
      { uid, username, defaultRating: config.defaultRating, modes: PLAY_MODES },
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