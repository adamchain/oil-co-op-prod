import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Member } from "../models/Member.js";
import { config, stripeEnabled } from "../config.js";
import { registerMember, registerMemberSchema } from "../services/memberRegistration.js";
import { requireAuth, signToken, type AuthedRequest } from "../middleware/auth.js";
import {
  addPropertyToMember,
  findExistingAccount,
  memberContactMatches,
  serializeProperties,
  toMatchHint,
} from "../services/accountLookup.js";
const router = Router();

const lookupSchema = z.object({
  email: z.string().optional().default(""),
  phone: z.string().optional().default(""),
});

const propertyBodySchema = z.object({
  label: z.string().optional().default(""),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional().default(""),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
});

const claimSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  confirmingEmail: z.string().optional().default(""),
  confirmingPhone: z.string().optional().default(""),
  property: propertyBodySchema,
});

/** Soft-check before / during signup: matching email or phone on an existing member. */
router.post("/lookup-account", async (req, res) => {
  const parsed = lookupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const email = parsed.data.email.trim();
  const phone = parsed.data.phone.trim();
  if (!email && !phone) {
    res.json({ match: false });
    return;
  }
  const found = await findExistingAccount({ email, phone });
  if (!found) {
    res.json({ match: false });
    return;
  }
  res.json({
    match: true,
    hint: toMatchHint(found.member, found.matchedBy),
  });
});

/**
 * Existing member confirms identity (password) and adds a new property address
 * from the signup form instead of creating a second account.
 */
router.post("/claim-add-property", async (req, res) => {
  const parsed = claimSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const member = await Member.findOne({ email: parsed.data.email.toLowerCase() });
  if (!member || !(await bcrypt.compare(parsed.data.password, member.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  if (!memberContactMatches(member, parsed.data.confirmingEmail, parsed.data.confirmingPhone)) {
    res.status(403).json({
      error: "That account does not match the email or phone you entered on the signup form",
    });
    return;
  }

  const properties = await addPropertyToMember(member, parsed.data.property);
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
    properties,
  });
});

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
    properties: serializeProperties(m),
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
