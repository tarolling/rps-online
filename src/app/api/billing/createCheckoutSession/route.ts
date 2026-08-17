import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/neo4j";
import { getAuthedUid } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

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
    if (result.records.length === 0) {
      return NextResponse.json({ error: "Player not found." }, { status: 404 });
    }

    const stripe = getStripe();
    let customerId: string | null = result.records[0].get("stripeCustomerId");

    if (!customerId) {
      const customer = await stripe.customers.create({ metadata: { uid } });
      customerId = customer.id;
      // Persist before creating the Checkout Session so the webhook can always
      // resolve customer -> uid, even if it arrives before the user returns.
      await runQuery(
        "MATCH (p:Player {uid: $uid}) SET p.stripeCustomerId = $customerId",
        { uid, customerId },
        "write",
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const randomSuffix = Math.random().toString(36).slice(2, 10).padEnd(8, "a");

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: process.env.STRIPE_PRICE_ID_PREMIUM!, quantity: 1 }],
      success_url: `${baseUrl}/profile/${uid}?checkout=success`,
      cancel_url: `${baseUrl}/profile/${uid}?checkout=cancel`,
      integration_identifier: `ranked_rps_premium_${randomSuffix}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("createCheckoutSession error:", err);
    return NextResponse.json({ error: "Failed to create checkout session." }, { status: 500 });
  }
}
