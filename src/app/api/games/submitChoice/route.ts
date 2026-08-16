import { NextRequest, NextResponse } from "next/server";
import { getAuthedUid } from "@/lib/auth";
import { submitChoiceServer } from "@/lib/matchmakingServer";
import { Choice } from "@/types/neo4j";

/**
 * Server-authoritative choice submission for async games. Unlike blitz (where
 * the client writes its choice directly to Firebase and a browser tab is
 * relied on to trigger resolution), async submissions go through this route
 * so resolution doesn't depend on any tab staying open — see `matchmakingServer.ts`.
 */
export async function POST(req: NextRequest) {
  const { gameId, choice } = await req.json();

  if (!gameId || !choice || !Object.values(Choice).includes(choice)) {
    return NextResponse.json({ error: "gameId and a valid choice are required." }, { status: 400 });
  }

  const authedUid = await getAuthedUid(req);
  if (!authedUid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await submitChoiceServer(gameId, authedUid, choice as Choice);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("submitChoice error:", err);
    return NextResponse.json({ error: (err as Error).message ?? "Failed to submit choice." }, { status: 400 });
  }
}
