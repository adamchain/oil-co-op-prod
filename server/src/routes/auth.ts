import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Member } from "../models/Member.js";
import { config, stripeEnabled } from "../config.js";
import { registerMember, registerMemberSchema } from "../services/memberRegistration.js";
import { requireAuth, signToken, type AuthedRequest } from "../middleware/auth.js";
const router = Router();

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
  const parsed = registerMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const result = await registerMember(parsed.data, { signedUpVia: "web" });
  if (!result.ok) {
    res.status(result.status).json({
      error: result.error,
      ...(result.detail ? { detail: result.detail } : {}),
      ...result.extra,
    });
    return;
  }

  const member = result.member;
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
