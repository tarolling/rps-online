import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/neo4j";

export async function POST(req: NextRequest) {
  const { username } = await req.json();

  if (!username) {
    return NextResponse.json({ error: "Username is required." }, { status: 400 });
  }

  try {
    const read = await runQuery(`
      MATCH (p:Player)
      WHERE toLower(p.username) = toLower($username)
      RETURN p
      `, { username });

    return NextResponse.json({ usernameExists: read.records.length !== 0 });
  } catch (err) {
    console.error("checkUsername error:", err);
    return NextResponse.json({ error: "Failed to check username." }, { status: 500 });
  }
}