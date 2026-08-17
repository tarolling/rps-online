import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/neo4j";
import { getAuthedUid } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

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

  try {
    // Cancel any active subscription first — otherwise deleting the Player
    // node destroys the only stripeCustomerId -> uid mapping, leaving Stripe
    // billing a now-account-less customer indefinitely.
    const existing = await runQuery(
      "MATCH (p:Player {uid: $uid}) RETURN p.stripeSubscriptionId AS stripeSubscriptionId",
      { uid },
    );
    const stripeSubscriptionId: string | null = existing.records[0]?.get("stripeSubscriptionId") ?? null;
    if (stripeSubscriptionId) {
      await getStripe().subscriptions.cancel(stripeSubscriptionId);
    }

    await runQuery(`
      MATCH (p:Player {uid: $uid})
      DETACH DELETE p
      `, { uid }, "write");

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("deleteAccount error:", err);
    return NextResponse.json({ error: "Failed to delete account." }, { status: 500 });
  }
}