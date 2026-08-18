import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/neo4j";
import { getAuthedUid } from "@/lib/auth";
import { getStripe, customerExists } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const uid = await getAuthedUid(req);
  if (!uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runQuery(
      "MATCH (p:Player {uid: $uid}) RETURN p.stripeCustomerId AS stripeCustomerId",
      { uid },
    );
    const customerId: string | null = result.records[0]?.get("stripeCustomerId") ?? null;
    if (!customerId) {
      return NextResponse.json({ error: "No billing account found." }, { status: 400 });
    }

    const stripe = getStripe();
    if (!(await customerExists(stripe, customerId))) {
      // Stale — the account/key changed, or the customer was deleted in the
      // Dashboard. There's no subscription to manage either way; clear it so
      // the profile page stops offering "Manage Subscription" for a dead ID.
      await runQuery(
        "MATCH (p:Player {uid: $uid}) SET p.stripeCustomerId = null, p.isPremium = false",
        { uid },
        "write",
      );
      return NextResponse.json({ error: "No billing account found." }, { status: 400 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/profile/${uid}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("createPortalSession error:", err);
    return NextResponse.json({ error: "Failed to create billing portal session." }, { status: 500 });
  }
}
