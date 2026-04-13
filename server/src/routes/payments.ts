/**
 * Public payment routes - for payment link processing
 *
 * These routes allow members to complete payments via email links
 * without needing to log in.
 */
import { Router } from "express";
import { z } from "zod";
import type mongoose from "mongoose";
import { Member } from "../models/Member.js";
import { PaymentToken } from "../models/PaymentToken.js";
import { BillingEvent } from "../models/BillingEvent.js";
import { config, authorizeNetEnabled } from "../config.js";
import {
  chargeCard,
  createCustomerProfile,
  addPaymentProfile,
} from "../services/authorizeNet.js";
import { sendPaymentSuccessEmail } from "../services/mail.js";
import { logActivity } from "../services/activity.js";
import { nextJuneFirstAfterSignup } from "../utils/juneBilling.js";

const router = Router();

type PaymentTokenWithMember = {
  _id: mongoose.Types.ObjectId;
  token: string;
  memberId: {
    _id: mongoose.Types.ObjectId;
    firstName: string;
    lastName: string;
    email: string;
    memberNumber: string;
  };
  amountCents: number;
  kind: string;
  billingYear?: number;
  expiresAt: Date;
  usedAt?: Date | null;
  transactionId?: string;
};

/**
 * Get payment link details (no auth required)
 */
router.get("/link/:token", async (req, res) => {
  const paymentToken = await PaymentToken.findOne({ token: req.params.token })
    .populate("memberId", "firstName lastName email memberNumber")
    .lean() as PaymentTokenWithMember | null;

  if (!paymentToken) {
    res.status(404).json({ error: "Payment link not found or expired" });
    return;
  }

  if (paymentToken.usedAt) {
    res.status(400).json({ error: "This payment link has already been used" });
    return;
  }

  if (new Date(paymentToken.expiresAt) < new Date()) {
    res.status(400).json({ error: "This payment link has expired" });
    return;
  }

  const member = paymentToken.memberId;

  res.json({
    amountCents: paymentToken.amountCents,
    kind: paymentToken.kind,
    billingYear: paymentToken.billingYear,
    expiresAt: paymentToken.expiresAt,
    member: {
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      memberNumber: member.memberNumber,
    },
  });
});

/**
 * Process payment from payment link
 */
const processPaymentSchema = z.object({
  cardNumber: z.string().min(12),
  expiration: z.string().min(4), // "MMYY" or "MM/YY"
  cvv: z.string().min(3),
  saveCard: z.boolean().default(true),
});

router.post("/link/:token/pay", async (req, res) => {
  const paymentToken = await PaymentToken.findOne({ token: req.params.token });

  if (!paymentToken) {
    res.status(404).json({ error: "Payment link not found or expired" });
    return;
  }

  if (paymentToken.usedAt) {
    res.status(400).json({ error: "This payment link has already been used" });
    return;
  }

  if (new Date(paymentToken.expiresAt) < new Date()) {
    res.status(400).json({ error: "This payment link has expired" });
    return;
  }

  const parsed = processPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const member = await Member.findById(paymentToken.memberId);
  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  const body = parsed.data;

  // Mock mode if Authorize.Net not configured
  if (!authorizeNetEnabled) {
    const cardLast4 = body.cardNumber.replace(/\D/g, "").slice(-4);
    const mock = await BillingEvent.create({
      memberId: member._id,
      kind: paymentToken.kind,
      amountCents: paymentToken.amountCents,
      status: "mock",
      description: "Payment link - mock (Authorize.Net not configured)",
      billingYear: paymentToken.billingYear,
      cardLast4,
    });

    paymentToken.usedAt = new Date();
    paymentToken.transactionId = "mock";
    await paymentToken.save();

    await logActivity(member._id, "payment_link_used_mock", {
      amountCents: paymentToken.amountCents,
      kind: paymentToken.kind,
    });

    res.json({ ok: true, mock: true, billingEvent: mock });
    return;
  }

  // Charge the card
  const chargeResult = await chargeCard({
    amountCents: paymentToken.amountCents,
    cardNumber: body.cardNumber,
    expiration: body.expiration,
    cardCode: body.cvv,
    invoiceNumber: `${member.memberNumber}-${paymentToken.billingYear || ""}`,
    description: `${paymentToken.kind} payment - ${member.memberNumber}`,
    email: member.email,
    firstName: member.firstName,
    lastName: member.lastName,
    addressLine1: member.addressLine1,
    city: member.city,
    state: member.state,
    postalCode: member.postalCode,
  });

  if (!chargeResult.ok) {
    await BillingEvent.create({
      memberId: member._id,
      kind: paymentToken.kind,
      amountCents: paymentToken.amountCents,
      status: "failed",
      description: `Payment link failed: ${chargeResult.error}`,
      billingYear: paymentToken.billingYear,
      cardLast4: body.cardNumber.replace(/\D/g, "").slice(-4),
    });

    await logActivity(member._id, "payment_link_failed", {
      error: chargeResult.error,
    });

    res.status(402).json({ ok: false, error: chargeResult.error });
    return;
  }

  // Payment successful
  const billingEvent = await BillingEvent.create({
    memberId: member._id,
    kind: paymentToken.kind,
    amountCents: chargeResult.amountCents,
    status: "succeeded",
    description: "Payment link - card charged",
    billingYear: paymentToken.billingYear,
    authnetTransactionId: chargeResult.transactionId,
    authnetAuthCode: chargeResult.authCode,
    cardLast4: chargeResult.accountLast4,
    cardType: chargeResult.accountType,
  });

  // Mark token as used
  paymentToken.usedAt = new Date();
  paymentToken.transactionId = chargeResult.transactionId;
  await paymentToken.save();

  // Update member billing info
  if (paymentToken.kind === "annual") {
    member.lastAnnualChargeAt = new Date();
    member.lastAnnualChargeAmountCents = chargeResult.amountCents;
    member.nextAnnualBillingDate = nextJuneFirstAfterSignup(new Date());
    member.reminderSent30d = false;
    member.reminderSent7d = false;
    member.reminderSent1d = false;
  } else if (paymentToken.kind === "registration") {
    member.registrationFeePaidAt = new Date();
  }

  // Store card on file if requested
  if (body.saveCard) {
    try {
      let customerProfileId = member.authnetCustomerProfileId;
      if (!customerProfileId) {
        const profileResult = await createCustomerProfile({
          merchantCustomerId: member.memberNumber || String(member._id),
          email: member.email,
          description: `${member.firstName} ${member.lastName}`,
        });
        if (profileResult.ok) {
          customerProfileId = profileResult.customerProfileId;
        }
      }

      if (customerProfileId) {
        const paymentResult = await addPaymentProfile({
          customerProfileId,
          cardNumber: body.cardNumber,
          expirationDate: body.expiration,
          cardCode: body.cvv,
          firstName: member.firstName,
          lastName: member.lastName,
          addressLine1: member.addressLine1,
          city: member.city,
          state: member.state,
          postalCode: member.postalCode,
        });

        if (paymentResult.ok) {
          member.authnetCustomerProfileId = customerProfileId;
          member.authnetPaymentProfileId = paymentResult.paymentProfileId;
          member.authnetCardLast4 = paymentResult.cardLast4;
          member.authnetCardExpiry = body.expiration.replace(/\D/g, "");
          member.paymentMethod = "card";
          member.autoRenew = true;
        }
      }
    } catch (e) {
      // Card storage failed but payment succeeded - not critical
      console.error("Failed to store card on file:", e);
    }
  }

  await member.save();

  await logActivity(member._id, "payment_link_succeeded", {
    amountCents: chargeResult.amountCents,
    transactionId: chargeResult.transactionId,
    kind: paymentToken.kind,
    cardSaved: body.saveCard,
  });

  // Send confirmation email
  await sendPaymentSuccessEmail(
    member,
    chargeResult.amountCents,
    chargeResult.transactionId,
    chargeResult.accountLast4,
    paymentToken.billingYear || new Date().getFullYear()
  );

  res.json({
    ok: true,
    billingEvent,
    transactionId: chargeResult.transactionId,
    cardSaved: body.saveCard && !!member.authnetPaymentProfileId,
  });
});

export default router;
