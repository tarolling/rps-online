import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/neo4j";
import { getAuthedUid } from "@/lib/auth";
import { createTournament } from "@/lib/tournaments.server";
import type { TournamentPlayerCap } from "@/types/neo4j";

export async function POST(req: NextRequest) {
  const authedUid = await getAuthedUid(req);
  if (!authedUid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, description, playerCap, startTime } = await req.json();
  if (!name || !description || !playerCap || !startTime) {
    return NextResponse.json({ error: "Name, description, playerCap, and startTime are required." }, { status: 400 });
  }

  if (authedUid !== process.env.ADMIN_UID) {
    // Re-derive premium status server-side from the authenticated uid — never
    // trust a client-supplied flag for this.
    const player = await runQuery("MATCH (p:Player {uid: $uid}) RETURN p.isPremium AS isPremium", { uid: authedUid });
    if (player.records.length === 0) {
      return NextResponse.json({ error: "Player not found." }, { status: 404 });
    }
    if (!(player.records[0].get("isPremium") ?? false)) {
      return NextResponse.json({ error: "Creating tournaments requires Premium or admin access." }, { status: 403 });
    }
  }

  try {
    await createTournament(name, description, playerCap as TournamentPlayerCap, startTime);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("createTournament error:", err);
    return NextResponse.json({ error: "Failed to create tournament." }, { status: 500 });
  }
}
