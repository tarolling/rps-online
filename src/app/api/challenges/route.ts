import neo4j from "neo4j-driver";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { createGame } from "@/lib/matchmaking.server";
import { getDriver } from "@/lib/neo4j";
import { getAuthedUid } from "@/lib/auth";
import { withErrorHandling } from "@/lib/apiHandler";
import config from "@/config/settings.json";

type Action = "send" | "accept" | "reject" | "clear";

// Challenges always create a blitz-style game (matchmaking.server.ts's createGame
// has no mode parameter), so the blitz rating is what's relevant here.
async function fetchPlayer(uid: string): Promise<{ username: string; rating: number }> {
  const session = getDriver().session({ database: process.env.NEO4J_DATABASE });
  try {
    const result = await session.executeRead((tx) =>
      tx.run(`
        MATCH (p:Player {uid: $uid})
        OPTIONAL MATCH (p)-[:HAS_RATING]->(rt:Rating {mode: "blitz"})
        RETURN p.username AS username, rt.value AS rating
      `, { uid }),
    );
    if (result.records.length === 0) throw new Error(`Player ${uid} not found`);
    const r = result.records[0];
    const rating = r.get("rating");
    return { username: r.get("username"), rating: rating !== null ? neo4j.integer.toNumber(rating) : config.defaultRating };
  } finally {
    await session.close();
  }
}

export const POST = withErrorHandling("challenges", async (req: NextRequest) => {
  const { action, fromId, fromUsername, toId } = await req.json() as {
    action: Action;
    fromId: string;
    fromUsername?: string;
    toId: string;
  };

  if (!action || !fromId || !toId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // authenticate so that only the ego user can manage their own challenges
  const authedUid = await getAuthedUid(req);
  const actingId = action === "send" ? fromId : toId;
  if (!authedUid || authedUid !== actingId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const challengeRef = adminDb.ref(`challenges/${toId}/${fromId}`);

  switch (action) {
  case "send": {
    // Don't allow duplicate challenges
    const existing = await challengeRef.get();
    if (existing.exists()) return NextResponse.json({ error: "Challenge already pending" }, { status: 400 });

    await challengeRef.set({ fromId, fromUsername: fromUsername ?? "", sentAt: Date.now(), status: "pending" });
    return NextResponse.json({ ok: true });
  }

  case "accept": {
    // Atomically claim the challenge before doing any of the slower game-creation
    // work below, so two concurrent accepts (double-click, two tabs) can't both
    // pass the check and both call createGame. Only the caller whose transaction
    // actually flips pending -> accepting "wins"; a racing second caller's
    // update function reruns against the now-"accepting" value and aborts.
    const txResult = await challengeRef.transaction((current) => {
      if (!current || current.status !== "pending") return undefined;
      return { ...current, status: "accepting" };
    });

    if (!txResult.committed || !txResult.snapshot.exists()) {
      return NextResponse.json({ error: "No pending challenge" }, { status: 404 });
    }

    try {
      // Fetch both players' data for game creation
      const [p1, p2] = await Promise.all([fetchPlayer(fromId), fetchPlayer(toId)]);

      const gameId = await createGame(
        fromId, p1.username, p1.rating,
        toId, p2.username, p2.rating,
      );

      await challengeRef.update({ status: "accepted", gameId });
      return NextResponse.json({ ok: true, gameId });
    } catch (error) {
      // Game creation failed after we claimed the challenge — revert so it's
      // not stuck in "accepting" forever and the players can retry.
      await challengeRef.update({ status: "pending" });
      throw error;
    }
  }

  case "reject":
  case "clear":
    await challengeRef.remove();
    return NextResponse.json({ ok: true });

  default:
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
});