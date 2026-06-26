import cron from "node-cron";
import { Member } from "../models/Member.js";
import { BillingEvent } from "../models/BillingEvent.js";
import { config, stripeEnabled, authorizeNetEnabled } from "../config.js";
import { followingJuneFirst, juneFirstYear } from "../utils/juneBilling.js";
import { chargeAnnualForCustomer } from "./stripeBilling.js";
import { chargeCustomerProfile } from "./authorizeNet.js";
import { logActivity } from "./activity.js";

// Note: this co-op does not send any email automatically. The June 1 cron below
// still charges cards on file, but never emails members — staff send any
// receipts, reminders, or notices manually from the admin UI.

async function runJuneFirstAnnualBilling() {
  const today = new Date();
  if (today.getUTCMonth() !== 5 || today.getUTCDate() !== 1) return;

  const year = today.getUTCFullYear();
  const j1 = juneFirstYear(year);

  const juneStart = new Date(Date.UTC(year, 5, 1, 0, 0, 0));
  const juneEnd = new Date(Date.UTC(year, 5, 2, 0, 0, 0));
  const members = await Member.find({
    role: "member",
    status: "active",
    nextAnnualBillingDate: { $gte: juneStart, $lt: juneEnd },
  });

  for (const m of members) {
    const due = new Date(m.nextAnnualBillingDate);
    if (
      due.getUTCFullYear() !== year ||
      due.getUTCMonth() !== 5 ||
      due.getUTCDate() !== 1
    ) {
      continue;
    }

    if (m.lifetimeAnnualFeeWaived) {
      await BillingEvent.create({
        memberId: m._id,
        kind: "annual",
        amountCents: 0,
        status: "waived",
        description: "Lifetime waiver (5+ referrals)",
        billingYear: year,
      });
      m.nextAnnualBillingDate = followingJuneFirst(j1);
      m.reminderSent30d = false;
      m.reminderSent7d = false;
      m.reminderSent1d = false;
      await m.save();
      await logActivity(m._id, "annual_billing_waived", { reason: "lifetime" });
      continue;
    }

    if ((m.referralWaiveCredits || 0) > 0) {
      m.referralWaiveCredits = (m.referralWaiveCredits || 0) - 1;
      await BillingEvent.create({
        memberId: m._id,
        kind: "annual",
        amountCents: 0,
        status: "waived",
        description: "Referral waiver credit applied",
        billingYear: year,
      });
      m.nextAnnualBillingDate = followingJuneFirst(j1);
      m.reminderSent30d = false;
      m.reminderSent7d = false;
      m.reminderSent1d = false;
      await m.save();
      await logActivity(m._id, "annual_billing_waived", { reason: "referral_credit" });
      continue;
    }

    const amount = config.annualFeeCents;

    // Check if member has Authorize.Net stored card
    const hasAuthnetCard = m.authnetCustomerProfileId && m.authnetPaymentProfileId;
    const hasStripeCard = m.stripeCustomerId && m.stripeDefaultPaymentMethodId;

    // Check payers or no card on file → send invoice
    if (m.paymentMethod === "check" || (!hasAuthnetCard && !hasStripeCard)) {
      await BillingEvent.create({
        memberId: m._id,
        kind: "annual",
        amountCents: amount,
        status: "pending",
        description: "Awaiting check / card setup",
        billingYear: year,
      });
      m.nextAnnualBillingDate = followingJuneFirst(j1);
      m.reminderSent30d = false;
      m.reminderSent7d = false;
      m.reminderSent1d = false;
      await m.save();
      await logActivity(m._id, "annual_invoice_check", { amountCents: amount });
      continue;
    }

    // Try Authorize.Net CIM first (preferred)
    if (hasAuthnetCard && authorizeNetEnabled) {
      const authnetResult = await chargeCustomerProfile({
        customerProfileId: m.authnetCustomerProfileId!,
        paymentProfileId: m.authnetPaymentProfileId!,
        amountCents: amount,
        invoiceNumber: `${m.memberNumber}-${year}`,
        description: `Annual membership ${year}`,
      });

      if (authnetResult.ok) {
        await BillingEvent.create({
          memberId: m._id,
          kind: "annual",
          amountCents: amount,
          status: "succeeded",
          authnetTransactionId: authnetResult.transactionId,
          authnetAuthCode: authnetResult.authCode,
          cardLast4: authnetResult.accountLast4,
          billingYear: year,
          description: "Authorize.Net auto-charge",
        });
        m.lastAnnualChargeAt = new Date();
        m.lastAnnualChargeAmountCents = amount;
        m.nextAnnualBillingDate = followingJuneFirst(j1);
        m.reminderSent30d = false;
        m.reminderSent7d = false;
        m.reminderSent1d = false;
        await m.save();
        await logActivity(m._id, "annual_charge_succeeded", {
          amountCents: amount,
          processor: "authnet",
          transactionId: authnetResult.transactionId,
        });
        continue;
      } else {
        // Authorize.Net charge failed
        await BillingEvent.create({
          memberId: m._id,
          kind: "annual",
          amountCents: amount,
          status: "failed",
          description: `Authorize.Net: ${authnetResult.error}`,
          billingYear: year,
        });
        await logActivity(m._id, "annual_charge_failed", {
          error: authnetResult.error,
          processor: "authnet",
        });
        continue;
      }
    }

    // Fallback to Stripe if no Authorize.Net
    if (!stripeEnabled) {
      await BillingEvent.create({
        memberId: m._id,
        kind: "annual",
        amountCents: amount,
        status: "mock",
        description: "Dev: Stripe off — simulated success",
        billingYear: year,
      });
      m.lastAnnualChargeAt = new Date();
      m.lastAnnualChargeAmountCents = amount;
      m.nextAnnualBillingDate = followingJuneFirst(j1);
      m.reminderSent30d = false;
      m.reminderSent7d = false;
      m.reminderSent1d = false;
      await m.save();
      await logActivity(m._id, "annual_charge_mock", { amountCents: amount });
      continue;
    }

    const result = await chargeAnnualForCustomer({
      customerId: m.stripeCustomerId!,
      paymentMethodId: m.stripeDefaultPaymentMethodId!,
      amountCents: amount,
      memberEmail: m.email,
    });

    if ("paymentIntentId" in result && result.status === "succeeded") {
      await BillingEvent.create({
        memberId: m._id,
        kind: "annual",
        amountCents: amount,
        status: "succeeded",
        stripePaymentIntentId: result.paymentIntentId,
        billingYear: year,
      });
      m.lastAnnualChargeAt = new Date();
      m.lastAnnualChargeAmountCents = amount;
      m.nextAnnualBillingDate = followingJuneFirst(j1);
      m.reminderSent30d = false;
      m.reminderSent7d = false;
      m.reminderSent1d = false;
      await m.save();
      await logActivity(m._id, "annual_charge_succeeded", { amountCents: amount, processor: "stripe" });
    } else {
      await BillingEvent.create({
        memberId: m._id,
        kind: "annual",
        amountCents: amount,
        status: "failed",
        description: "failed" in result ? result.failed : "charge failed",
        billingYear: year,
      });
      await logActivity(m._id, "annual_charge_failed", {
        error: "failed" in result ? result.failed : "",
        processor: "stripe",
      });
    }
  }
}

export function startScheduledJobs() {
  cron.schedule("5 12 * * *", () => {
    void runJuneFirstAnnualBilling();
  });
  console.info("Cron scheduled: daily 12:05 UTC — June 1 annual billing (no automatic emails)");
}
