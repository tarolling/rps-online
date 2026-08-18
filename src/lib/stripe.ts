import Stripe from "stripe";

let stripe: Stripe;

export function getStripe(): Stripe {
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return stripe;
}

/**
 * A stored customer ID can go stale — the Stripe account/key changed, or the
 * customer was deleted directly in the Dashboard — so verify before trusting
 * it rather than letting a Checkout/Portal session call fail outright.
 */
export async function customerExists(stripe: Stripe, customerId: string): Promise<boolean> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return !customer.deleted;
  } catch (err) {
    if (err instanceof Stripe.errors.StripeInvalidRequestError && err.code === "resource_missing") {
      return false;
    }
    throw err;
  }
}
