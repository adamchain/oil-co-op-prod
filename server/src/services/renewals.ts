import mongoose from "mongoose";
import { Member } from "../models/Member.js";
import { BillingEvent } from "../models/BillingEvent.js";
import { config, stripeEnabled, authorizeNetEnabled } from "../config.js";
import { followingJuneFirst } from "../utils/juneBilling.js";
import { annualFeeCentsFor } from "../utils/membershipFees.js";
import { chargeAnnualForCustomer } from "./stripeBilling.js";
import { chargeCustomerProfile } from "./authorizeNet.js";
import { logActivity } from "./activity.js";

/**
 * Annual renewal engine. The June 1 cron runs it for that day; staff can also
 * preview or run it for any date from the admin Renewals page, which is how the
 * co-op runs mock renewals (e.g. set a few test members to renew 9/17 and run 9/17).
 *
 * Outcomes mirror how the co-op handles renewals today:
 * - card on file → charged; next renewal moves to next June 1
 * - lifetime / additional property / referral credit → $0 waived line; date moves forward
 * - no payment method, check payer, expired card, or declined card → "on hold"
 *   (Sam's yellow tab): the renewal date stays put until staff record a payment.
 */

export type RenewalOutcome =
  | "charged"
  | "simulated_charge"
  | "would_charge"
  | "waived_lifetime"
  | "waived_additional_property"
  | "waived_referral_credit"
  | "hold_no_payment_method"
  | "hold_check"
  | "hold_auto_renew_off"
  | "hold_card_expired"
  | "hold_card_declined";

export const HOLD_REASON_LABELS: Record<string, string> = {
  no_payment_method: "No payment method on file",
  check: "Awaiting check",
  auto_renew_off: "Auto-renew is turned off",
  card_expired: "Card on file is expired",
  card_declined: "Card was declined",
};

export type RenewalResultRow = {
  memberId: string;
  memberNumber: string;
  name: string;
  plan: string;
  amountCents: number;
  outcome: RenewalOutcome;
  detail: string;
};

export type RenewalReport = {
  dueDate: string;
  dryRun: boolean;
  total: number;
  counts: Partial<Record<RenewalOutcome, number>>;
  rows: RenewalResultRow[];
};

function dayBounds(d: Date): { start: Date; end: Date; due: Date } {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  return {
    start: new Date(Date.UTC(y, m, day, 0, 0, 0)),
    end: new Date(Date.UTC(y, m, day + 1, 0, 0, 0)),
    due: new Date(Date.UTC(y, m, day, 12, 0, 0)),
  };
}

/** Authorize.Net stores expiry as "MMYY"; a card is good through the last day of that month. */
export function cardExpiredBy(expiry: string | null | undefined, on: Date): boolean {
  const digits = String(expiry || "").replace(/\D/g, "");
  if (digits.length !== 4) return false;
  const month = Number(digits.slice(0, 2));
  const year = 2000 + Number(digits.slice(2));
  if (!month || month > 12) return false;
  const firstOfNextMonth = Date.UTC(year, month, 1, 0, 0, 0);
  return on.getTime() >= firstOfNextMonth;
}

type MemberDocLike = InstanceType<typeof Member>;

function resetReminders(m: MemberDocLike) {
  m.reminderSent30d = false;
  m.reminderSent7d = false;
  m.reminderSent1d = false;
}

async function putOnHold(m: MemberDocLike, reason: keyof typeof HOLD_REASON_LABELS, dueDate: Date) {
  m.renewalOnHold = true;
  m.renewalHoldReason = reason;
  m.renewalHoldSince = dueDate;
  await m.save();
  await logActivity(m._id, "annual_renewal_on_hold", { reason, dueDate: dueDate.toISOString() });
}

/**
 * Clear an on-hold renewal once staff record the payment (or waive it): the member
 * comes off hold and their next renewal moves to the June 1 after the one they missed.
 * Returns true when a hold was cleared. Caller saves the member.
 */
export function clearRenewalHold(m: MemberDocLike): boolean {
  if (!m.renewalOnHold) return false;
  m.renewalOnHold = false;
  m.renewalHoldReason = "";
  m.renewalHoldSince = null;
  m.nextAnnualBillingDate = followingJuneFirst(new Date(m.nextAnnualBillingDate));
  resetReminders(m);
  return true;
}

export async function runAnnualRenewal(opts: { date: Date; dryRun?: boolean }): Promise<RenewalReport> {
  const dryRun = Boolean(opts.dryRun);
  const { start, end, due } = dayBounds(opts.date);
  const year = due.getUTCFullYear();
  const next = followingJuneFirst(due);

  const members = await Member.find({
    role: "member",
    status: "active",
    renewalOnHold: { $ne: true },
    nextAnnualBillingDate: { $gte: start, $lt: end },
  }).sort({ lastName: 1, firstName: 1 });

  const rows: RenewalResultRow[] = [];

  for (const m of members) {
    const amount = annualFeeCentsFor(m);
    const row: RenewalResultRow = {
      memberId: String(m._id),
      memberNumber: m.memberNumber || "",
      name: `${m.firstName || ""} ${m.lastName || ""}`.trim(),
      plan: String(m.membershipPlan || "standard"),
      amountCents: amount,
      outcome: "would_charge",
      detail: "",
    };
    rows.push(row);

    const lp = (m.legacyProfile || {}) as { waiveFeeLifetime?: boolean };
    const isLinkedProperty = Boolean(m.primaryMemberId);
    const isLifetime = Boolean(m.lifetimeAnnualFeeWaived || lp.waiveFeeLifetime);

    // Free renewals: additional properties, lifetime members, banked referral credits.
    if (isLinkedProperty || isLifetime || (m.referralWaiveCredits || 0) > 0) {
      row.amountCents = 0;
      row.outcome = isLinkedProperty
        ? "waived_additional_property"
        : isLifetime
          ? "waived_lifetime"
          : "waived_referral_credit";
      row.detail = `Next renewal → June 1, ${next.getUTCFullYear()}`;
      if (dryRun) continue;
      if (row.outcome === "waived_referral_credit") {
        m.referralWaiveCredits = (m.referralWaiveCredits || 0) - 1;
      }
      await BillingEvent.create({
        memberId: m._id,
        kind: "annual",
        amountCents: 0,
        status: "waived",
        description: isLinkedProperty
          ? "Additional property — linked to primary membership (free)"
          : isLifetime
            ? "Lifetime waiver"
            : "Referral waiver credit applied",
        billingYear: year,
      });
      if (isLinkedProperty || lp.waiveFeeLifetime) m.lifetimeAnnualFeeWaived = true;
      m.nextAnnualBillingDate = next;
      resetReminders(m);
      await m.save();
      await logActivity(m._id, "annual_billing_waived", { reason: row.outcome });
      continue;
    }

    const hasAuthnetCard = Boolean(m.authnetCustomerProfileId && m.authnetPaymentProfileId);
    const hasStripeCard = Boolean(m.stripeCustomerId && m.stripeDefaultPaymentMethodId);

    // Paying by check, auto-renew off, or no card saved → on hold until staff record payment.
    if (m.paymentMethod === "check" || !m.autoRenew || (!hasAuthnetCard && !hasStripeCard)) {
      const reason =
        m.paymentMethod === "check"
          ? "check"
          : !hasAuthnetCard && !hasStripeCard
            ? "no_payment_method"
            : "auto_renew_off";
      row.outcome =
        reason === "check" ? "hold_check" : reason === "auto_renew_off" ? "hold_auto_renew_off" : "hold_no_payment_method";
      row.detail = HOLD_REASON_LABELS[reason];
      if (dryRun) continue;
      await BillingEvent.create({
        memberId: m._id,
        kind: "annual",
        amountCents: amount,
        status: "pending",
        description: `On hold — ${HOLD_REASON_LABELS[reason].toLowerCase()}`,
        billingYear: year,
      });
      await putOnHold(m, reason, due);
      continue;
    }

    // Don't try a card we know is expired; put it on hold so staff can get a new one.
    if (hasAuthnetCard && cardExpiredBy(m.authnetCardExpiry, due)) {
      row.outcome = "hold_card_expired";
      row.detail = `Card ending ${m.authnetCardLast4 || "????"} expired ${m.authnetCardExpiry}`;
      if (dryRun) continue;
      await BillingEvent.create({
        memberId: m._id,
        kind: "annual",
        amountCents: amount,
        status: "pending",
        description: `On hold — card ending ${m.authnetCardLast4 || "????"} is expired`,
        cardLast4: m.authnetCardLast4 || "",
        billingYear: year,
      });
      await putOnHold(m, "card_expired", due);
      continue;
    }

    if (dryRun) {
      row.detail = hasAuthnetCard
        ? `Card ending ${m.authnetCardLast4 || "????"}`
        : "Card on file (Stripe)";
      continue;
    }

    const charged = async (fields: Record<string, unknown>, outcome: RenewalOutcome, processor: string) => {
      await BillingEvent.create({
        memberId: m._id,
        kind: "annual",
        amountCents: amount,
        billingYear: year,
        ...fields,
      });
      m.lastAnnualChargeAt = new Date();
      m.lastAnnualChargeAmountCents = amount;
      m.nextAnnualBillingDate = next;
      resetReminders(m);
      await m.save();
      await logActivity(m._id, outcome === "charged" ? "annual_charge_succeeded" : "annual_charge_mock", {
        amountCents: amount,
        processor,
      });
      row.outcome = outcome;
      row.detail = `Next renewal → June 1, ${next.getUTCFullYear()}`;
    };

    const declined = async (error: string, processor: string) => {
      await BillingEvent.create({
        memberId: m._id,
        kind: "annual",
        amountCents: amount,
        status: "failed",
        description: `${processor}: ${error}`,
        cardLast4: m.authnetCardLast4 || "",
        billingYear: year,
      });
      await logActivity(m._id, "annual_charge_failed", { error, processor });
      await putOnHold(m, "card_declined", due);
      row.outcome = "hold_card_declined";
      row.detail = error;
    };

    // Authorize.Net CIM first (preferred).
    if (hasAuthnetCard && authorizeNetEnabled) {
      const r = await chargeCustomerProfile({
        customerProfileId: m.authnetCustomerProfileId!,
        paymentProfileId: m.authnetPaymentProfileId!,
        amountCents: amount,
        invoiceNumber: `${m.memberNumber}-${year}`,
        description: `Annual membership ${year}`,
      });
      if (r.ok) {
        await charged(
          {
            status: "succeeded",
            authnetTransactionId: r.transactionId,
            authnetAuthCode: r.authCode,
            cardLast4: r.accountLast4,
            description: "Authorize.Net auto-charge",
          },
          "charged",
          "authnet"
        );
      } else {
        await declined(r.error, "Authorize.Net");
      }
      continue;
    }

    // No processor configured (local/dev): record a simulated success.
    if (!stripeEnabled) {
      await charged({ status: "mock", description: "Dev: no card processor configured — simulated success" }, "simulated_charge", "none");
      continue;
    }

    const result = await chargeAnnualForCustomer({
      customerId: m.stripeCustomerId!,
      paymentMethodId: m.stripeDefaultPaymentMethodId!,
      amountCents: amount,
      memberEmail: m.email,
    });
    if ("paymentIntentId" in result && result.status === "succeeded") {
      await charged({ status: "succeeded", stripePaymentIntentId: result.paymentIntentId }, "charged", "stripe");
    } else {
      await declined("failed" in result ? String(result.failed) : "charge failed", "Stripe");
    }
  }

  const counts: Partial<Record<RenewalOutcome, number>> = {};
  for (const r of rows) counts[r.outcome] = (counts[r.outcome] || 0) + 1;

  return { dueDate: due.toISOString(), dryRun, total: rows.length, counts, rows };
}

/**
 * Mock renew is for local dev and for production while Authorize.Net is still sandbox.
 * A live Authorize.Net environment or a Stripe key turns it off.
 */
export function mockRenewalTestingEnabled(): boolean {
  if (stripeEnabled) return false;
  if (authorizeNetEnabled && config.authorizeNet.env !== "sandbox") return false;
  return true;
}

/**
 * Temporary admin test: record one simulated annual charge without contacting a processor.
 * The date-based Run renewal still charges sandbox cards; this button does not.
 */
export async function runAdminMockRenewal(memberId: string): Promise<
  | { ok: true; amountCents: number; billingYear: number; nextAnnualBillingDate: Date; memberNumber: string }
  | { ok: false; error: string }
> {
  if (!mockRenewalTestingEnabled()) {
    return {
      ok: false,
      error: "Mock renewal is disabled while Stripe is configured or Authorize.Net is set to production.",
    };
  }
  if (!mongoose.isValidObjectId(memberId)) return { ok: false, error: "Invalid id" };

  const m = await Member.findById(memberId);
  if (!m || m.role !== "member") return { ok: false, error: "Member not found." };
  if (m.status !== "active") return { ok: false, error: "Member is not active." };

  const lp = (m.legacyProfile || {}) as { waiveFeeLifetime?: boolean };
  const isLinkedProperty = Boolean(m.primaryMemberId);
  const isLifetime = Boolean(m.lifetimeAnnualFeeWaived || lp.waiveFeeLifetime);
  if (isLinkedProperty || isLifetime || (m.referralWaiveCredits || 0) > 0) {
    return { ok: false, error: "This member would be waived on renewal, not mock-charged." };
  }

  const hasAuthnetCard = Boolean(m.authnetCustomerProfileId && m.authnetPaymentProfileId);
  const hasStripeCard = Boolean(m.stripeCustomerId && m.stripeDefaultPaymentMethodId);
  if (authorizeNetEnabled && config.authorizeNet.env === "sandbox" && !hasAuthnetCard) {
    return {
      ok: false,
      error: "While Authorize.Net sandbox is on, mock renewal is only for members with a vaulted card.",
    };
  }
  if (m.paymentMethod === "check" || !m.autoRenew || (!hasAuthnetCard && !hasStripeCard)) {
    return { ok: false, error: "Mock renewal only applies to auto-renew members with a card on file." };
  }

  const due = m.nextAnnualBillingDate ? new Date(m.nextAnnualBillingDate) : new Date();
  if (hasAuthnetCard && cardExpiredBy(m.authnetCardExpiry, due)) {
    return { ok: false, error: "The card on file is expired, so this renewal would go on hold." };
  }

  const billingYear = due.getUTCFullYear();
  const next = followingJuneFirst(due);
  const amount = annualFeeCentsFor(m);
  await BillingEvent.create({
    memberId: m._id,
    kind: "annual",
    amountCents: amount,
    status: "mock",
    description: "Sandbox test: simulated annual charge (card not charged)",
    cardLast4: m.authnetCardLast4 || "",
    billingYear,
  });
  m.lastAnnualChargeAt = new Date();
  m.lastAnnualChargeAmountCents = amount;
  m.nextAnnualBillingDate = next;
  m.renewalOnHold = false;
  m.renewalHoldReason = "";
  m.renewalHoldSince = null;
  resetReminders(m);
  await m.save();
  await logActivity(m._id, "annual_charge_mock", {
    amountCents: amount,
    source: "admin_temp_button",
    processor: "none",
  });
  return { ok: true, amountCents: amount, billingYear, nextAnnualBillingDate: next, memberNumber: m.memberNumber || "" };
}
