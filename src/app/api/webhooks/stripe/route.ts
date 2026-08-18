import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { runQuery } from "@/lib/neo4j";
import { getStripe } from "@/lib/stripe";

// Subscription state is derived purely from `status` in one shared path so
// created/updated/deleted deliveries — and any out-of-order or replayed
// delivery, since Stripe guarantees at-least-once but not in-order — all
// converge on the same result instead of drifting via per-event-type logic.
// `past_due` still counts as premium: Stripe's dunning retries are given a
// grace period rather than revoking access on the first failed charge.
async function syncSubscriptionStatus(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const isPremium = ["active", "trialing", "past_due"].includes(subscription.status);

  const result = await runQuery(
    `MATCH (p:Player {stripeCustomerId: $customerId})
     SET p.isPremium = $isPremium, p.stripeSubscriptionId = $subscriptionId
     RETURN p.uid AS uid`,
    { customerId, isPremium, subscriptionId: subscription.id },
    "write",
  );

  if (result.records.length === 0) {
    console.error(`Stripe webhook: no Player found for stripeCustomerId ${customerId}`);
  }
}

export async function POST(req: NextRequest) {
  // Raw bytes are required for signature verification — req.json() would
  // consume/reformat the body first and break constructEvent.
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscriptionStatus(event.data.object);
      break;
    case "checkout.session.completed":
    case "invoice.payment_failed":
      // Informational only — subscription-status events above are the
      // source of truth for isPremium.
      break;
    default:
      break;
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }
}
