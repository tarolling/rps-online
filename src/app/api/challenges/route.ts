import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { createGame } from "@/lib/matchmaking.server";

type Action = "send" | "accept" | "reject" | "clear";

export async function POST(req: NextRequest) {
  const { action, fromId, fromUsername, toId } = await req.json() as {
    action: Action;
    fromId: string;
    fromUsername?: string;
    toId: string;
  };

  if (!action || !fromId || !toId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
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
    const snap = await challengeRef.get();
    if (!snap.exists()) return NextResponse.json({ error: "No pending challenge" }, { status: 404 });

    const challenge = snap.val();

    // Fetch both players' data for game creation
    const [p1Snap, p2Snap] = await Promise.all([
      adminDb.ref(`users/${fromId}`).get(),
      adminDb.ref(`users/${toId}`).get(),
    ]);

    const p1 = p1Snap.val();
    const p2 = p2Snap.val();

    const gameId = await createGame(
      fromId, challenge.fromUsername, p1?.rating ?? 1000,
      toId, p2?.username ?? "Player", p2?.rating ?? 1000,
    );

    await challengeRef.update({ status: "accepted", gameId });
    return NextResponse.json({ ok: true, gameId });
  }

  case "reject":
  case "clear":
    await challengeRef.remove();
    return NextResponse.json({ ok: true });

  default:
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}