import Stripe from "stripe";
import { config, stripeEnabled } from "../config.js";

let stripe: Stripe | null = null;

function getStripe(): Stripe | null {
  if (!stripeEnabled) return null;
  if (!stripe) stripe = new Stripe(config.stripeSecretKey, { apiVersion: "2025-02-24.acacia" });
  return stripe;
}

/** Confirm a PaymentIntent from the client (after card collected). */
export async function confirmPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  const s = getStripe();
  if (!s) throw new Error("Stripe not configured");
  return s.paymentIntents.retrieve(paymentIntentId);
}

export async function chargeAnnualForCustomer(params: {
  customerId: string;
  paymentMethodId: string;
  amountCents: number;
  memberEmail: string;
}): Promise<{ paymentIntentId: string; status: string } | { failed: string }> {
  const s = getStripe();
  if (!s) return { failed: "no_stripe" };
  try {
    const pi = await s.paymentIntents.create({
      amount: params.amountCents,
      currency: "usd",
      customer: params.customerId,
      payment_method: params.paymentMethodId,
      off_session: true,
      confirm: true,
      receipt_email: params.memberEmail,
      description: "Annual co-op membership — June 1",
    });
    if (pi.status === "succeeded") {
      return { paymentIntentId: pi.id, status: pi.status };
    }
    return { failed: pi.status };
  } catch (e) {
    return { failed: String(e) };
  }
}
