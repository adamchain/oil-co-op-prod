import cron from "node-cron";
import { Member } from "../models/Member.js";
import { BillingEvent } from "../models/BillingEvent.js";
import { config, stripeEnabled } from "../config.js";
import { followingJuneFirst, daysUntil, juneFirstYear } from "../utils/juneBilling.js";
import { chargeAnnualForCustomer } from "./stripeBilling.js";
import { sendMemberEmail } from "./mail.js";
import { logActivity } from "./activity.js";

function reminderYearForJuneBilling(d: Date): number {
  return d.getUTCFullYear();
}

async function sendJuneReminders() {
  const today = new Date();
  const members = await Member.find({
    role: "member",
    status: "active",
    nextAnnualBillingDate: { $exists: true },
  });

  for (const m of members) {
    const ns = m.notificationSettings;
    if (!ns?.emailEnabled || !ns?.renewalReminders) continue;
    const target = new Date(m.nextAnnualBillingDate);
    const d = daysUntil(target, today);
    const cycleYear = reminderYearForJuneBilling(target);

    if (m.reminderCycleYear !== cycleYear) {
      m.reminderSent30d = false;
      m.reminderSent7d = false;
      m.reminderSent1d = false;
      m.reminderCycleYear = cycleYear;
      await m.save();
    }

    const subjectPrefix = "Annual membership — June 1 billing";

    if (d === 30 && !m.reminderSent30d) {
      await sendMemberEmail(
        m._id,
        m.email,
        `${subjectPrefix} (30 days)`,
        `Hello ${m.firstName},\n\nThis is a reminder that your annual co-op membership fee will be billed on ${target.toDateString()}.\n\n` +
          (m.autoRenew && m.paymentMethod === "card"
            ? "Your card on file will be charged automatically.\n"
            : "Please arrange payment (check instructions are available from the office).\n")
      );
      m.reminderSent30d = true;
      await m.save();
    } else if (d === 7 && !m.reminderSent7d) {
      await sendMemberEmail(
        m._id,
        m.email,
        `${subjectPrefix} (7 days)`,
        `Hello ${m.firstName},\n\nYour annual membership fee will be billed in one week (${target.toDateString()}).\n`
      );
      m.reminderSent7d = true;
      await m.save();
    } else if (d === 1 && !m.reminderSent1d) {
      await sendMemberEmail(
        m._id,
        m.email,
        `${subjectPrefix} (tomorrow)`,
        `Hello ${m.firstName},\n\nYour annual membership fee will be billed tomorrow (${target.toDateString()}).\n`
      );
      m.reminderSent1d = true;
      await m.save();
    }
  }
}

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

    if (m.paymentMethod === "check" || !m.stripeCustomerId || !m.stripeDefaultPaymentMethodId) {
      await BillingEvent.create({
        memberId: m._id,
        kind: "annual",
        amountCents: amount,
        status: "pending",
        description: "Awaiting check / card setup",
        billingYear: year,
      });
      if (m.notificationSettings?.emailEnabled && m.notificationSettings?.billingNotices) {
        await sendMemberEmail(
          m._id,
          m.email,
          "Annual membership — payment needed",
          `Hello ${m.firstName},\n\nYour annual membership fee of $${(amount / 100).toFixed(2)} is due. Please mail a check or call the office to pay by card.\n`
        );
      }
      m.nextAnnualBillingDate = followingJuneFirst(j1);
      m.reminderSent30d = false;
      m.reminderSent7d = false;
      m.reminderSent1d = false;
      await m.save();
      await logActivity(m._id, "annual_invoice_check", { amountCents: amount });
      continue;
    }

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
      customerId: m.stripeCustomerId,
      paymentMethodId: m.stripeDefaultPaymentMethodId,
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
      await logActivity(m._id, "annual_charge_succeeded", { amountCents: amount });
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
      });
    }
  }
}

export function startScheduledJobs() {
  cron.schedule("5 12 * * *", () => {
    void sendJuneReminders();
    void runJuneFirstAnnualBilling();
  });
  console.info("Cron scheduled: daily 12:05 UTC — June reminders + June 1 annual billing");
}
