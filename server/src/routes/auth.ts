import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Member } from "../models/Member.js";
import { BillingEvent } from "../models/BillingEvent.js";
import { config, stripeEnabled } from "../config.js";
import { nextJuneFirstAfterSignup } from "../utils/juneBilling.js";
import { applyReferralCredit, findReferrerByToken } from "../services/referrals.js";
import { confirmPaymentIntent } from "../services/stripeBilling.js";
import { sendWelcomeEmail } from "../services/mail.js";
import { logActivity } from "../services/activity.js";
import { requireAuth, signToken, type AuthedRequest } from "../middleware/auth.js";
const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional().default(""),
  addressLine1: z.string().optional().default(""),
  addressLine2: z.string().optional().default(""),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  postalCode: z.string().optional().default(""),
  paymentMethod: z.enum(["card", "check"]).default("card"),
  /** Referrer: email, name, phone, or member ID */
  referrerToken: z.string().optional().default(""),
  /** Required when Stripe is configured — client confirms card first */
  paymentIntentId: z.string().optional(),
});

async function nextMemberNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `OC-${year}-`;
  const lastDocs = await Member.find({
    memberNumber: new RegExp(`^${prefix}`),
  })
    .sort({ memberNumber: -1 })
    .limit(1)
    .select("memberNumber")
    .lean();
  const last = lastDocs[0] as { memberNumber?: string } | undefined;
  let n = 1;
  if (last?.memberNumber) {
    const part = last.memberNumber.slice(prefix.length);
    const parsed = parseInt(part, 10);
    if (Number.isFinite(parsed)) n = parsed + 1;
  }
  return `${prefix}${String(n).padStart(4, "0")}`;
}

router.post("/registration-intent", async (req, res) => {
  if (!stripeEnabled) {
    res.json({ mock: true, amountCents: config.registrationFeeCents });
    return;
  }
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(config.stripeSecretKey, { apiVersion: "2025-02-24.acacia" });
  const email =
    typeof req.body?.receiptEmail === "string" && req.body.receiptEmail.includes("@")
      ? req.body.receiptEmail
      : undefined;
  const pi = await stripe.paymentIntents.create({
    amount: config.registrationFeeCents,
    currency: "usd",
    receipt_email: email,
    description: "Co-op registration",
    metadata: { type: "registration" },
    automatic_payment_methods: { enabled: true },
  });
  res.json({
    clientSecret: pi.client_secret,
    paymentIntentId: pi.id,
    amountCents: config.registrationFeeCents,
  });
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const body = parsed.data;

  const exists = await Member.findOne({ email: body.email.toLowerCase() });
  if (exists) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  if (stripeEnabled) {
    if (!body.paymentIntentId) {
      res.status(400).json({ error: "paymentIntentId required when Stripe is enabled" });
      return;
    }
    try {
      const pi = await confirmPaymentIntent(body.paymentIntentId);
      if (pi.status !== "succeeded") {
        res.status(402).json({ error: "Payment not completed", status: pi.status });
        return;
      }
      if (pi.amount !== config.registrationFeeCents) {
        res.status(400).json({ error: "Payment amount does not match registration fee" });
        return;
      }
    } catch (e) {
      res.status(402).json({ error: "Payment verification failed", detail: String(e) });
      return;
    }
  }

  const passwordHash = await bcrypt.hash(body.password, 10);
  const signupDate = new Date();
  const nextAnnual = nextJuneFirstAfterSignup(signupDate);
  const memberNumber = await nextMemberNumber();

  let referredByMemberId = undefined as undefined | import("mongoose").Types.ObjectId;
  if (body.referrerToken) {
    const ref = await findReferrerByToken(body.referrerToken);
    if (ref) referredByMemberId = ref._id;
  }

  const member = await Member.create({
    memberNumber,
    email: body.email.toLowerCase(),
    passwordHash,
    firstName: body.firstName,
    lastName: body.lastName,
    phone: body.phone,
    addressLine1: body.addressLine1,
    addressLine2: body.addressLine2,
    city: body.city,
    state: body.state,
    postalCode: body.postalCode,
    paymentMethod: body.paymentMethod,
    autoRenew: body.paymentMethod === "card",
    nextAnnualBillingDate: nextAnnual,
    oilCompanyId: null,
    referredByMemberId: referredByMemberId ?? null,
    registrationFeePaidAt: signupDate,
    notificationSettings: {
      emailEnabled: true,
      renewalReminders: true,
      billingNotices: true,
      oilCompanyUpdates: true,
      marketing: false,
      smsEnabled: false,
      smsPhone: "",
    },
  });

  await BillingEvent.create({
    memberId: member._id,
    kind: "registration",
    amountCents: config.registrationFeeCents,
    status: stripeEnabled ? "succeeded" : "mock",
    stripePaymentIntentId: body.paymentIntentId || "",
    description: "Registration fee (charged at signup)",
  });

  if (referredByMemberId) {
    await applyReferralCredit(member._id, referredByMemberId);
  }

  await logActivity(member._id, "member_registered", {
    memberNumber,
    nextAnnualBillingDate: nextAnnual.toISOString(),
  });

  await sendWelcomeEmail(member);

  const token = signToken(String(member._id));
  res.status(201).json({
    token,
    member: {
      id: String(member._id),
      email: member.email,
      firstName: member.firstName,
      lastName: member.lastName,
      memberNumber: member.memberNumber,
      nextAnnualBillingDate: member.nextAnnualBillingDate,
      oilCompanyId: member.oilCompanyId,
    },
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const member = await Member.findOne({ email: parsed.data.email.toLowerCase() });
  if (!member || !(await bcrypt.compare(parsed.data.password, member.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  res.json({
    token: signToken(String(member._id)),
    member: {
      id: String(member._id),
      email: member.email,
      firstName: member.firstName,
      lastName: member.lastName,
      memberNumber: member.memberNumber,
      role: member.role,
      nextAnnualBillingDate: member.nextAnnualBillingDate,
    },
  });
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const m = req.member!;
  res.json({
    id: String(m._id),
    email: m.email,
    firstName: m.firstName,
    lastName: m.lastName,
    memberNumber: m.memberNumber,
    role: m.role,
    phone: m.phone,
    addressLine1: m.addressLine1,
    addressLine2: m.addressLine2,
    city: m.city,
    state: m.state,
    postalCode: m.postalCode,
    status: m.status,
    oilCompanyId: m.oilCompanyId,
    nextAnnualBillingDate: m.nextAnnualBillingDate,
    paymentMethod: m.paymentMethod,
    autoRenew: m.autoRenew,
    successfulReferralCount: m.successfulReferralCount,
    lifetimeAnnualFeeWaived: m.lifetimeAnnualFeeWaived,
    referralWaiveCredits: m.referralWaiveCredits,
    notificationSettings: m.notificationSettings,
    legacyProfile: m.legacyProfile || {},
  });
});

export default router;
