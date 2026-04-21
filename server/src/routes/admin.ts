import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import crypto from "crypto";
import { requireAuth, requireAdmin, type AuthedRequest } from "../middleware/auth.js";
import { Member } from "../models/Member.js";
import { OilCompany } from "../models/OilCompany.js";
import { BillingEvent } from "../models/BillingEvent.js";
import { ActivityLog } from "../models/ActivityLog.js";
import { CommunicationLog } from "../models/CommunicationLog.js";
import { Referral } from "../models/Referral.js";
import { PaymentToken } from "../models/PaymentToken.js";
import { EmailTemplate, EMAIL_TEMPLATE_KEYS } from "../models/EmailTemplate.js";
import { logActivity } from "../services/activity.js";
import { sendMemberEmail, sendPaymentLinkEmail, sendOilCompanyAssignedEmail } from "../services/mail.js";
import { applyTemplateVariables, ensureEmailTemplates } from "../services/emailTemplateStore.js";
import { nextJuneFirstAfterSignup } from "../utils/juneBilling.js";
import { chargeCard, addPaymentProfile, createCustomerProfile } from "../services/authorizeNet.js";
import { config, authorizeNetEnabled } from "../config.js";
import bcrypt from "bcryptjs";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/email-templates", async (_req, res) => {
  await ensureEmailTemplates();
  const templates = await EmailTemplate.find({ key: { $in: EMAIL_TEMPLATE_KEYS } })
    .sort({ key: 1 })
    .lean();
  res.json({ templates });
});

const updateEmailTemplateSchema = z.object({
  subject: z.string().min(1),
  html: z.string().min(1),
  text: z.string().optional().default(""),
});

router.put("/email-templates/:key", async (req: AuthedRequest, res) => {
  const key = req.params.key;
  if (!EMAIL_TEMPLATE_KEYS.includes(key as (typeof EMAIL_TEMPLATE_KEYS)[number])) {
    res.status(400).json({ error: "Invalid template key" });
    return;
  }
  const parsed = updateEmailTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  await ensureEmailTemplates();
  const template = await EmailTemplate.findOneAndUpdate(
    { key },
    {
      $set: {
        subject: parsed.data.subject,
        html: parsed.data.html,
        text: parsed.data.text,
      },
    },
    { new: true }
  ).lean();
  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  await logActivity(
    new mongoose.Types.ObjectId(req.userId!),
    "admin_email_template_updated",
    { key, adminId: req.userId },
    new mongoose.Types.ObjectId(req.userId!)
  );

  res.json({ template });
});

const sendTestTemplateSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  html: z.string().min(1),
  text: z.string().optional().default(""),
});

const testTemplateSampleData: Record<string, unknown> = {
  firstName: "John",
  lastName: "Smith",
  memberNumber: "M-2024-0042",
  nextBillingDate: "June 1, 2025",
  daysUntil: 7,
  billingDate: "June 1, 2025",
  amount: "$120.00",
  isAutoRenew: true,
  cardLast4: "4242",
  transactionId: "TXN-123456789",
  billingYear: 2025,
  reason: "Card declined - insufficient funds",
  paymentUrl: "https://oilcoop.example.com/pay/abc123xyz",
  expiresAt: "May 15, 2025",
  companyName: "ABC Heating Oil Co.",
  companyPhone: "(555) 123-4567",
};

router.post("/email-templates/:key/test", async (req: AuthedRequest, res) => {
  const key = req.params.key;
  if (!EMAIL_TEMPLATE_KEYS.includes(key as (typeof EMAIL_TEMPLATE_KEYS)[number])) {
    res.status(400).json({ error: "Invalid template key" });
    return;
  }
  const parsed = sendTestTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const subject = applyTemplateVariables(parsed.data.subject, testTemplateSampleData);
  const text = applyTemplateVariables(parsed.data.text, testTemplateSampleData);
  const html = applyTemplateVariables(parsed.data.html, testTemplateSampleData);

  await sendMemberEmail(
    new mongoose.Types.ObjectId(req.userId!),
    parsed.data.to,
    subject,
    text || "This is a test email preview.",
    html
  );

  res.json({ ok: true });
});

router.get("/members", async (req, res) => {
  const q = (req.query.q as string) || "";
  const status = req.query.status as string | undefined;
  const signedUpVia = req.query.signedUpVia as string | undefined;
  const filter: Record<string, unknown> = { role: "member" };
  if (status && ["active", "expired", "cancelled"].includes(status)) {
    filter.status = status;
  }
  if (signedUpVia && ["web", "phone", "admin"].includes(signedUpVia)) {
    filter.signedUpVia = signedUpVia;
  }
  if (q.trim()) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [
      { firstName: rx },
      { lastName: rx },
      { email: rx },
      { phone: rx },
      { memberNumber: rx },
    ];
  }
  const members = await Member.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("oilCompanyId", "name")
    .lean();
  res.json({ members });
});

router.get("/members/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const member = await Member.findById(req.params.id)
    .populate("oilCompanyId")
    .populate("referredByMemberId", "firstName lastName email memberNumber");
  if (!member || member.role !== "member") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [billing, activity, communications, referral] = await Promise.all([
    BillingEvent.find({ memberId: member._id }).sort({ createdAt: -1 }).limit(50).lean(),
    ActivityLog.find({ memberId: member._id }).sort({ createdAt: -1 }).limit(100).lean(),
    CommunicationLog.find({ memberId: member._id }).sort({ createdAt: -1 }).limit(50).lean(),
    Referral.findOne({ newMemberId: member._id }).populate("referrerMemberId", "firstName lastName email").lean(),
  ]);
  res.json({ member, billing, activity, communications, referral });
});

const patchMemberSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  oilCompanyId: z.string().nullable().optional(),
  status: z.enum(["active", "expired", "cancelled"]).optional(),
  notes: z.string().optional(),
  paymentMethod: z.enum(["card", "check"]).optional(),
  autoRenew: z.boolean().optional(),
  legacyProfile: z.record(z.string(), z.unknown()).optional(),
});

router.patch("/members/:id", async (req: AuthedRequest, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = patchMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const member = await Member.findById(req.params.id);
  if (!member || member.role !== "member") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const prevOil = member.oilCompanyId?.toString();
  const body = parsed.data;
  if (body.oilCompanyId !== undefined) {
    if (body.oilCompanyId === null) {
      member.oilCompanyId = null;
    } else if (mongoose.isValidObjectId(body.oilCompanyId)) {
      const oc = await OilCompany.findById(body.oilCompanyId);
      if (!oc) {
        res.status(400).json({ error: "Invalid oil company" });
        return;
      }
      member.oilCompanyId = oc._id;
    }
  }
  if (body.status) member.status = body.status;
  if (body.firstName !== undefined) member.firstName = body.firstName;
  if (body.lastName !== undefined) member.lastName = body.lastName;
  if (body.email !== undefined) member.email = body.email.toLowerCase().trim();
  if (body.phone !== undefined) member.phone = body.phone;
  if (body.addressLine1 !== undefined) member.addressLine1 = body.addressLine1;
  if (body.addressLine2 !== undefined) member.addressLine2 = body.addressLine2;
  if (body.city !== undefined) member.city = body.city;
  if (body.state !== undefined) member.state = body.state;
  if (body.postalCode !== undefined) member.postalCode = body.postalCode;
  if (body.notes !== undefined) member.notes = body.notes;
  if (body.paymentMethod) {
    member.paymentMethod = body.paymentMethod;
    if (body.paymentMethod === "check") member.autoRenew = false;
  }
  if (body.autoRenew !== undefined) member.autoRenew = body.autoRenew;
  if (body.legacyProfile !== undefined) {
    member.legacyProfile = {
      ...(typeof member.legacyProfile === "object" && member.legacyProfile ? member.legacyProfile : {}),
      ...body.legacyProfile,
    };
  }
  await member.save();

  await logActivity(
    member._id,
    "admin_member_updated",
    { fields: body, adminId: req.userId },
    new mongoose.Types.ObjectId(req.userId!)
  );

  const newOil = member.oilCompanyId?.toString();
  if (body.oilCompanyId !== undefined && newOil && newOil !== prevOil) {
    const oc = await OilCompany.findById(member.oilCompanyId);
    if (oc?.contactEmail && oc.contactEmail.includes("@")) {
      const text =
        `New co-op member assigned to your company:\n\n` +
        `Name: ${member.firstName} ${member.lastName}\n` +
        `Email: ${member.email}\n` +
        `Phone: ${member.phone || "—"}\n` +
        `Address: ${member.addressLine1}, ${member.city}, ${member.state} ${member.postalCode}\n` +
        `Member #: ${member.memberNumber}\n`;
      try {
        const nodemailer = await import("nodemailer");
        const { config } = await import("../config.js");
        if (config.smtp.host) {
          const t = nodemailer.createTransport({
            host: config.smtp.host,
            port: config.smtp.port,
            secure: config.smtp.port === 465,
            auth:
              config.smtp.user && config.smtp.pass
                ? { user: config.smtp.user, pass: config.smtp.pass }
                : undefined,
          });
          await t.sendMail({
            from: config.emailFrom,
            to: oc.contactEmail,
            subject: `Co-op member assignment: ${member.memberNumber}`,
            text,
          });
        } else {
          console.info(`[oil company email dev]\nTo: ${oc.contactEmail}\n${text}`);
        }
        await CommunicationLog.create({
          memberId: member._id,
          channel: "oil_company_email",
          subject: `Assigned to ${oc.name}`,
          bodyPreview: text.slice(0, 500),
          status: "sent",
          meta: { oilCompanyId: oc._id.toString() },
        });
      } catch (e) {
        await CommunicationLog.create({
          memberId: member._id,
          channel: "oil_company_email",
          subject: `Assigned to ${oc.name}`,
          status: "failed",
          meta: { error: String(e) },
        });
      }
    }
    if (member.notificationSettings?.emailEnabled && member.notificationSettings?.oilCompanyUpdates) {
      await sendMemberEmail(
        member._id,
        member.email,
        "Your oil company has been assigned",
        `Hello ${member.firstName},\n\nYour heating oil broker has linked your membership to: ${oc?.name || "your oil company"}.\n`
      );
    }
  }

  res.json({ member });
});

const createMemberSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional().default(""),
  addressLine1: z.string().optional().default(""),
  addressLine2: z.string().optional().default(""),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  postalCode: z.string().optional().default(""),
  status: z.enum(["active", "expired", "cancelled"]).optional().default("active"),
  notes: z.string().optional().default(""),
  signedUpVia: z.enum(["web", "phone", "admin"]).optional().default("admin"),
});

async function nextMemberNumber(): Promise<string> {
  const last = (await Member.findOne({ role: "member", memberNumber: { $regex: /^OC-\d+$/ } })
    .sort({ createdAt: -1 })
    .select("memberNumber")
    .lean()) as { memberNumber?: string } | null;
  const n = last?.memberNumber ? Number(last.memberNumber.replace("OC-", "")) : 1000;
  return `OC-${String((Number.isFinite(n) ? n : 1000) + 1).padStart(6, "0")}`;
}

router.post("/members", async (req: AuthedRequest, res) => {
  const parsed = createMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const payload = parsed.data;
  const email =
    payload.email?.toLowerCase().trim() ||
    `member-${Date.now()}-${Math.floor(Math.random() * 10000)}@oilcoop.local`;
  const exists = await Member.findOne({ email }).lean();
  if (exists) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }

  const passwordHash = await bcrypt.hash(`Temp-${Date.now()}`, 10);
  const member = await Member.create({
    memberNumber: await nextMemberNumber(),
    email,
    passwordHash,
    firstName: payload.firstName,
    lastName: payload.lastName,
    phone: payload.phone,
    addressLine1: payload.addressLine1,
    addressLine2: payload.addressLine2,
    city: payload.city,
    state: payload.state,
    postalCode: payload.postalCode,
    role: "member",
    status: payload.status,
    signedUpVia: payload.signedUpVia,
    notes: payload.notes,
    paymentMethod: "check",
    autoRenew: false,
    nextAnnualBillingDate: nextJuneFirstAfterSignup(new Date()),
  });

  await logActivity(
    member._id,
    "admin_member_created",
    { adminId: req.userId },
    new mongoose.Types.ObjectId(req.userId!)
  );

  res.status(201).json({ member });
});

const addNoteSchema = z.object({
  text: z.string().min(1),
});

router.post("/members/:id/notes", async (req: AuthedRequest, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = addNoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const member = await Member.findById(req.params.id);
  if (!member || member.role !== "member") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Get admin info for attribution
  const admin = await Member.findById(req.userId).select("email firstName lastName").lean() as { email?: string; firstName?: string; lastName?: string } | null;
  const createdBy = admin ? `${admin.firstName || ""} ${admin.lastName || ""}`.trim() || admin.email || "admin" : "admin";

  const newNote = {
    text: parsed.data.text,
    createdAt: new Date(),
    createdBy,
  };

  // Initialize notesHistory array if not present
  if (!Array.isArray(member.notesHistory)) {
    member.notesHistory = [];
  }

  member.notesHistory.push(newNote);
  await member.save();

  await logActivity(
    member._id,
    "admin_note_added",
    { notePreview: parsed.data.text.slice(0, 100), adminId: req.userId },
    new mongoose.Types.ObjectId(req.userId!)
  );

  res.json({ ok: true, note: newNote, notesHistory: member.notesHistory });
});

router.delete("/members/:id", async (req: AuthedRequest, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const member = await Member.findById(req.params.id);
  if (!member || member.role !== "member") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await Promise.all([
    BillingEvent.deleteMany({ memberId: member._id }),
    ActivityLog.deleteMany({ memberId: member._id }),
    CommunicationLog.deleteMany({ memberId: member._id }),
    Referral.deleteMany({ $or: [{ newMemberId: member._id }, { referrerMemberId: member._id }] }),
  ]);
  await member.deleteOne();

  await logActivity(
    member._id,
    "admin_member_deleted",
    { adminId: req.userId, memberNumber: member.memberNumber },
    new mongoose.Types.ObjectId(req.userId!)
  );
  res.json({ ok: true });
});

router.get("/oil-companies", async (_req, res) => {
  const list = await OilCompany.find({ active: true }).sort({ name: 1 }).lean();
  res.json({ oilCompanies: list });
});

const oilCoSchema = z.object({
  name: z.string().min(1),
  contactEmail: z.string().optional().default(""),
  contactPhone: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

router.post("/oil-companies", async (req, res) => {
  const parsed = oilCoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const oc = await OilCompany.create(parsed.data);
  res.status(201).json({ oilCompany: oc });
});

router.patch("/oil-companies/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = oilCoSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const oc = await OilCompany.findById(req.params.id);
  if (!oc) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const body = parsed.data;
  if (body.name !== undefined) oc.name = body.name;
  if (body.contactEmail !== undefined) oc.contactEmail = body.contactEmail;
  if (body.contactPhone !== undefined) oc.contactPhone = body.contactPhone;
  if (body.notes !== undefined) oc.notes = body.notes;
  await oc.save();
  res.json({ oilCompany: oc });
});

router.delete("/oil-companies/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const oc = await OilCompany.findById(req.params.id);
  if (!oc) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // Check if any members are assigned to this company
  const memberCount = await Member.countDocuments({ oilCompanyId: oc._id });
  if (memberCount > 0) {
    // Soft delete - just mark as inactive
    oc.active = false;
    await oc.save();
    res.json({ ok: true, softDeleted: true, message: `Company deactivated (${memberCount} members still assigned)` });
    return;
  }
  await oc.deleteOne();
  res.json({ ok: true });
});

router.get("/reports/summary", async (_req, res) => {
  const [
    totalMembers,
    activeMembers,
    byStatus,
    billingAgg,
    referralCount,
    lifetimeWaived,
    withOilCo,
  ] = await Promise.all([
    Member.countDocuments({ role: "member" }),
    Member.countDocuments({ role: "member", status: "active" }),
    Member.aggregate([
      { $match: { role: "member" } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    BillingEvent.aggregate([
      {
        $match: {
          status: { $in: ["succeeded", "mock"] },
          kind: { $in: ["registration", "annual"] },
        },
      },
      { $group: { _id: "$kind", totalCents: { $sum: "$amountCents" }, count: { $sum: 1 } } },
    ]),
    Referral.countDocuments(),
    Member.countDocuments({ role: "member", lifetimeAnnualFeeWaived: true }),
    Member.countDocuments({ role: "member", oilCompanyId: { $ne: null } }),
  ]);

  res.json({
    totalMembers,
    activeMembers,
    membersByStatus: Object.fromEntries(byStatus.map((x) => [x._id, x.count])),
    billingByKind: Object.fromEntries(
      billingAgg.map((x) => [x._id, { totalCents: x.totalCents, count: x.count }])
    ),
    totalReferralsRecorded: referralCount,
    membersWithLifetimeAnnualWaiver: lifetimeWaived,
    membersWithOilCompanyAssigned: withOilCo,
  });
});

router.get("/reports/billing-export", async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(0);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  const events = await BillingEvent.find({
    createdAt: { $gte: from, $lte: to },
  })
    .populate("memberId", "memberNumber email firstName lastName")
    .sort({ createdAt: -1 })
    .lean();

  const rows = events.map((e) => {
    const m = e.memberId as unknown as {
      memberNumber?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
    } | null;
    return {
      date: e.createdAt,
      kind: e.kind,
      status: e.status,
      amountCents: e.amountCents,
      billingYear: e.billingYear,
      memberNumber: m?.memberNumber,
      email: m?.email,
      name: m ? `${m.firstName} ${m.lastName}` : "",
    };
  });
  res.json({ rows });
});

function dayDiff(target: Date, from: Date = new Date()): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b - a) / 86400000);
}

router.get("/renewals/dashboard", async (_req, res) => {
  const members = (await Member.find({ role: "member" })
    .populate("oilCompanyId", "name")
    .select(
      "memberNumber firstName lastName email status paymentMethod autoRenew " +
        "stripeDefaultPaymentMethodId nextAnnualBillingDate lifetimeAnnualFeeWaived " +
        "referralWaiveCredits oilCompanyId"
    )
    .lean()) as Array<Record<string, unknown>>;

  const today = new Date();
  const normalized: any[] = members.map((mm: any) => {
    const due = mm.nextAnnualBillingDate ? new Date(String(mm.nextAnnualBillingDate)) : null;
    const daysUntilDue = due ? dayDiff(due, today) : null;
    const hasCard = Boolean(mm.stripeDefaultPaymentMethodId);
    return {
      ...mm,
      daysUntilDue,
      hasCard,
      isAutoRenewLane: mm.paymentMethod === "card" && Boolean(mm.autoRenew) && hasCard,
      isManualLane: mm.paymentMethod === "check" || !hasCard || !Boolean(mm.autoRenew),
    };
  });

  const lanes = {
    autoRenewLane: normalized.filter((m) => m.isAutoRenewLane && m.status === "active"),
    manualRenewalLane: normalized.filter((m) => m.isManualLane && m.status === "active"),
  };

  const filters = {
    renewingNext30Days: normalized.filter(
      (m) => m.status === "active" && m.daysUntilDue !== null && Number(m.daysUntilDue) >= 0 && Number(m.daysUntilDue) <= 30
    ),
    renewingNext7Days: normalized.filter(
      (m) => m.status === "active" && m.daysUntilDue !== null && Number(m.daysUntilDue) >= 0 && Number(m.daysUntilDue) <= 7
    ),
    autoRenewing: normalized.filter((m) => m.status === "active" && m.isAutoRenewLane),
    manualRenewalNeeded: normalized.filter((m) => m.status === "active" && m.isManualLane),
    noCardOnFile: normalized.filter((m) => m.status === "active" && !Boolean(m.stripeDefaultPaymentMethodId)),
    payingByCheck: normalized.filter((m) => m.status === "active" && m.paymentMethod === "check"),
    expired: normalized.filter((m) => m.status === "expired"),
    annualFeeWaived: normalized.filter(
      (m) => Boolean(m.lifetimeAnnualFeeWaived) || (typeof m.referralWaiveCredits === "number" && m.referralWaiveCredits > 0)
    ),
  };

  res.json({
    summary: {
      totalMembers: normalized.length,
      activeMembers: normalized.filter((m) => m.status === "active").length,
      autoRenewLaneCount: lanes.autoRenewLane.length,
      manualRenewalLaneCount: lanes.manualRenewalLane.length,
    },
    lanes,
    filters,
  });
});

router.get("/communications", async (req, res) => {
  const channel = (req.query.channel as string) || "";
  const status = (req.query.status as string) || "";
  const filter: Record<string, unknown> = {};
  if (channel) filter.channel = channel;
  if (status) filter.status = status;

  const rows = await CommunicationLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(300)
    .populate("memberId", "memberNumber firstName lastName email")
    .lean();

  res.json({ rows });
});

router.get("/exceptions", async (_req, res) => {
  const [failedAnnual, pendingManual, unassignedOilCompany, failedComms] = await Promise.all([
    BillingEvent.find({ kind: "annual", status: "failed" })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("memberId", "memberNumber firstName lastName email status")
      .lean(),
    BillingEvent.find({ kind: "annual", status: "pending" })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("memberId", "memberNumber firstName lastName email status")
      .lean(),
    Member.find({ role: "member", status: "active", oilCompanyId: null })
      .sort({ createdAt: -1 })
      .limit(100)
      .select("memberNumber firstName lastName email createdAt")
      .lean(),
    CommunicationLog.find({ status: "failed" })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("memberId", "memberNumber firstName lastName email")
      .lean(),
  ]);

  const tasks = [
    ...failedAnnual.map((x) => ({
      type: "failed_annual_charge",
      priority: "high",
      createdAt: x.createdAt,
      member: x.memberId,
      detail: x.description || "Annual charge failed",
    })),
    ...pendingManual.map((x) => ({
      type: "manual_payment_followup",
      priority: "medium",
      createdAt: x.createdAt,
      member: x.memberId,
      detail: x.description || "Manual payment pending",
    })),
    ...unassignedOilCompany.map((x) => ({
      type: "oil_company_assignment_needed",
      priority: "medium",
      createdAt: x.createdAt,
      member: x,
      detail: "Active member missing oil company assignment",
    })),
    ...failedComms.map((x) => ({
      type: "communication_failed",
      priority: "low",
      createdAt: x.createdAt,
      member: x.memberId,
      detail: `${x.channel} failed: ${x.subject || ""}`.trim(),
    })),
  ].sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime());

  res.json({
    summary: {
      failedAnnualCount: failedAnnual.length,
      pendingManualCount: pendingManual.length,
      unassignedOilCompanyCount: unassignedOilCompany.length,
      failedCommunicationCount: failedComms.length,
      totalTasks: tasks.length,
    },
    tasks,
  });
});

/**
 * Authorize.Net card charge initiated from the admin workbench (phone sign-ups
 * and staff-processed payments). Card data is sent directly to Authorize.Net
 * and is never stored. Only the auth response (transId, last4, authCode) is
 * persisted in the BillingEvent for reconciliation.
 */
const chargeSchema = z.object({
  amountCents: z.number().int().positive(),
  kind: z.enum(["registration", "annual", "manual_adjustment"]).default("annual"),
  billingYear: z.number().int().optional(),
  description: z.string().optional(),
  card: z.object({
    number: z.string().min(12),
    expiration: z.string().min(4),
    cvv: z.string().min(3),
    nameOnCard: z.string().optional(),
  }),
});

router.post("/members/:id/charge", async (req: AuthedRequest, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = chargeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const member = await Member.findById(req.params.id);
  if (!member || member.role !== "member") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const body = parsed.data;

  if (!authorizeNetEnabled) {
    // Dev/mock path — record a mock success so the UI flow can be exercised.
    const mock = await BillingEvent.create({
      memberId: member._id,
      kind: body.kind,
      amountCents: body.amountCents,
      status: "mock",
      description: body.description || `Mock ${body.kind} charge (Authorize.Net not configured)`,
      billingYear: body.billingYear ?? new Date().getFullYear(),
      processedByAdminId: req.userId,
      cardLast4: body.card.number.replace(/\D/g, "").slice(-4),
    });
    await logActivity(
      member._id,
      "admin_card_charge_mock",
      { amountCents: body.amountCents, adminId: req.userId },
      new mongoose.Types.ObjectId(req.userId!)
    );
    res.json({ ok: true, mock: true, billingEvent: mock });
    return;
  }

  const result = await chargeCard({
    amountCents: body.amountCents,
    cardNumber: body.card.number,
    expiration: body.card.expiration,
    cardCode: body.card.cvv,
    invoiceNumber: member.memberNumber || String(member._id).slice(-8),
    description: body.description || `${body.kind} — ${member.memberNumber || ""}`.trim(),
    email: member.email,
    firstName: member.firstName,
    lastName: member.lastName,
    addressLine1: member.addressLine1,
    city: member.city,
    state: member.state,
    postalCode: member.postalCode,
  });

  if (!result.ok) {
    const failed = await BillingEvent.create({
      memberId: member._id,
      kind: body.kind,
      amountCents: body.amountCents,
      status: "failed",
      description: `Authorize.Net: ${result.error}`,
      billingYear: body.billingYear ?? new Date().getFullYear(),
      processedByAdminId: req.userId,
      cardLast4: body.card.number.replace(/\D/g, "").slice(-4),
    });
    await logActivity(
      member._id,
      "admin_card_charge_failed",
      { error: result.error, adminId: req.userId },
      new mongoose.Types.ObjectId(req.userId!)
    );
    res.status(402).json({ ok: false, error: result.error, billingEvent: failed });
    return;
  }

  const ok = await BillingEvent.create({
    memberId: member._id,
    kind: body.kind,
    amountCents: result.amountCents,
    status: "succeeded",
    description: body.description || `Admin charge (Authorize.Net)`,
    billingYear: body.billingYear ?? new Date().getFullYear(),
    processedByAdminId: req.userId,
    authnetTransactionId: result.transactionId,
    authnetAuthCode: result.authCode,
    cardLast4: result.accountLast4,
    cardType: result.accountType,
  });

  if (body.kind === "annual") {
    member.lastAnnualChargeAt = new Date();
    member.lastAnnualChargeAmountCents = result.amountCents;
    member.nextAnnualBillingDate = nextJuneFirstAfterSignup(new Date());
  }
  if (body.kind === "registration") {
    member.registrationFeePaidAt = new Date();
  }
  await member.save();

  await logActivity(
    member._id,
    "admin_card_charge_succeeded",
    {
      amountCents: result.amountCents,
      transactionId: result.transactionId,
      adminId: req.userId,
    },
    new mongoose.Types.ObjectId(req.userId!)
  );

  res.json({ ok: true, billingEvent: ok, registrationFeeCents: config.registrationFeeCents });
});

/**
 * Generate a payment link for a member.
 * This creates a unique token that the member can use to pay without logging in.
 */
const paymentLinkSchema = z.object({
  amountCents: z.number().int().positive().optional(),
  kind: z.enum(["annual", "registration"]).default("annual"),
  billingYear: z.number().int().optional(),
  expiresInDays: z.number().int().min(1).max(90).default(30),
});

router.post("/members/:id/payment-link", async (req: AuthedRequest, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = paymentLinkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const member = await Member.findById(req.params.id);
  if (!member || member.role !== "member") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const body = parsed.data;
  const amountCents = body.amountCents ?? config.annualFeeCents;
  const billingYear = body.billingYear ?? new Date().getFullYear();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + body.expiresInDays);

  await PaymentToken.create({
    token,
    memberId: member._id,
    amountCents,
    kind: body.kind,
    billingYear,
    expiresAt,
  });

  const paymentUrl = `${config.clientOrigin}/pay/${token}`;

  // Send payment link email
  await sendPaymentLinkEmail(member, amountCents, paymentUrl, expiresAt);

  await logActivity(
    member._id,
    "admin_payment_link_sent",
    { amountCents, kind: body.kind, expiresAt: expiresAt.toISOString(), adminId: req.userId },
    new mongoose.Types.ObjectId(req.userId!)
  );

  res.json({
    ok: true,
    paymentUrl,
    token,
    expiresAt: expiresAt.toISOString(),
    amountCents,
  });
});

/**
 * Store card on file for a member (admin-initiated).
 * Creates or updates the Authorize.Net CIM profile.
 */
const storeCardSchema = z.object({
  cardNumber: z.string().min(12),
  expiration: z.string().min(4),
  cvv: z.string().min(3),
});

router.post("/members/:id/store-card", async (req: AuthedRequest, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = storeCardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const member = await Member.findById(req.params.id);
  if (!member || member.role !== "member") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (!authorizeNetEnabled) {
    res.status(400).json({ error: "Authorize.Net not configured" });
    return;
  }

  const body = parsed.data;

  // Create customer profile if needed
  let customerProfileId = member.authnetCustomerProfileId;
  if (!customerProfileId) {
    const profileResult = await createCustomerProfile({
      merchantCustomerId: member.memberNumber || String(member._id),
      email: member.email,
      description: `${member.firstName} ${member.lastName}`,
    });
    if (!profileResult.ok) {
      res.status(400).json({ error: profileResult.error });
      return;
    }
    customerProfileId = profileResult.customerProfileId;
  }

  // Add payment profile
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

  if (!paymentResult.ok) {
    res.status(400).json({ error: paymentResult.error });
    return;
  }

  // Update member with CIM profile IDs
  member.authnetCustomerProfileId = customerProfileId;
  member.authnetPaymentProfileId = paymentResult.paymentProfileId;
  member.authnetCardLast4 = paymentResult.cardLast4;
  member.authnetCardExpiry = body.expiration.replace(/\D/g, "");
  member.paymentMethod = "card";
  member.autoRenew = true;
  await member.save();

  await logActivity(
    member._id,
    "admin_card_stored",
    { cardLast4: paymentResult.cardLast4, adminId: req.userId },
    new mongoose.Types.ObjectId(req.userId!)
  );

  res.json({
    ok: true,
    cardLast4: paymentResult.cardLast4,
    customerProfileId,
    paymentProfileId: paymentResult.paymentProfileId,
  });
});

/**
 * Admin Assistant - Smart chatbot that answers questions with real data
 */
const assistantSchema = z.object({
  message: z.string().min(1).max(500),
});

router.post("/assistant", async (req: AuthedRequest, res) => {
  const parsed = assistantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid message" });
    return;
  }

  const msg = parsed.data.message.toLowerCase();

  // Gather real-time data for context
  const [
    totalMembers,
    activeMembers,
    expiredMembers,
    failedCharges,
    pendingManual,
    unassignedOil,
    recentSignups,
    renewingNext7Days,
    renewingNext30Days,
    totalOilCompanies,
    recentPayments,
  ] = await Promise.all([
    Member.countDocuments({ role: "member" }),
    Member.countDocuments({ role: "member", status: "active" }),
    Member.countDocuments({ role: "member", status: "expired" }),
    BillingEvent.countDocuments({ kind: "annual", status: "failed" }),
    BillingEvent.countDocuments({ kind: "annual", status: "pending" }),
    Member.countDocuments({ role: "member", status: "active", oilCompanyId: null }),
    Member.countDocuments({
      role: "member",
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    }),
    Member.countDocuments({
      role: "member",
      status: "active",
      nextAnnualBillingDate: {
        $gte: new Date(),
        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
    Member.countDocuments({
      role: "member",
      status: "active",
      nextAnnualBillingDate: {
        $gte: new Date(),
        $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    }),
    OilCompany.countDocuments({ active: { $ne: false } }),
    BillingEvent.countDocuments({
      status: "succeeded",
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    }),
  ]);

  // Get recent failed charges with details
  const recentFailedCharges = await BillingEvent.find({ kind: "annual", status: "failed" })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate("memberId", "firstName lastName memberNumber email")
    .lean();

  // Get members needing oil company assignment
  const needsOilAssignment = await Member.find({ role: "member", status: "active", oilCompanyId: null })
    .sort({ createdAt: -1 })
    .limit(5)
    .select("firstName lastName memberNumber email createdAt")
    .lean();

  // Get upcoming renewals
  const upcomingRenewals = await Member.find({
    role: "member",
    status: "active",
    nextAnnualBillingDate: {
      $gte: new Date(),
      $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })
    .sort({ nextAnnualBillingDate: 1 })
    .limit(5)
    .select("firstName lastName memberNumber nextAnnualBillingDate paymentMethod autoRenew")
    .lean();

  const totalTasks = failedCharges + pendingManual + unassignedOil;

  // Smart response based on question intent
  let response = "";
  let data: Record<string, unknown> = {};

  if (msg.includes("task") || msg.includes("attention") || msg.includes("todo") || msg.includes("action")) {
    if (totalTasks === 0) {
      response = "Great news! You have no pending tasks. All members have oil companies assigned, and there are no failed or pending payments.";
    } else {
      const items: string[] = [];
      if (failedCharges > 0) items.push(`**${failedCharges} failed payment${failedCharges > 1 ? "s"  : ""}** need follow-up`);
      if (pendingManual > 0) items.push(`**${pendingManual} pending manual payment${pendingManual > 1 ? "s" : ""}** awaiting processing`);
      if (unassignedOil > 0) items.push(`**${unassignedOil} member${unassignedOil > 1 ? "s" : ""}** need oil company assignment`);

      response = `You have **${totalTasks} task${totalTasks > 1 ? "s" : ""}** needing attention:\n\n` + items.map(i => `• ${i}`).join("\n");

      if (failedCharges > 0 && recentFailedCharges.length > 0) {
        response += "\n\n**Recent failed charges:**\n";
        for (const fc of recentFailedCharges) {
          const m = fc.memberId as { firstName?: string; lastName?: string; memberNumber?: string } | null;
          if (m) {
            response += `• ${m.firstName} ${m.lastName} (${m.memberNumber || "no #"})\n`;
          }
        }
      }
    }
    data = { totalTasks, failedCharges, pendingManual, unassignedOil };
  }
  else if (msg.includes("renewal") || msg.includes("upcoming") || msg.includes("billing") || msg.includes("due")) {
    response = `**Upcoming Renewals:**\n\n`;
    response += `• **${renewingNext7Days}** members renewing in the next 7 days\n`;
    response += `• **${renewingNext30Days}** members renewing in the next 30 days\n`;

    if (upcomingRenewals.length > 0) {
      response += "\n**Next 7 days:**\n";
      upcomingRenewals.forEach((m) => {
        const date = m.nextAnnualBillingDate ? new Date(m.nextAnnualBillingDate).toLocaleDateString() : "unknown";
        const method = m.autoRenew ? "auto-charge" : m.paymentMethod || "manual";
        response += `• ${m.firstName} ${m.lastName} (${m.memberNumber}) - ${date} (${method})\n`;
      });
    }
    data = { renewingNext7Days, renewingNext30Days, upcomingRenewals };
  }
  else if (msg.includes("member") && (msg.includes("count") || msg.includes("how many") || msg.includes("total") || msg.includes("stat"))) {
    response = `**Member Statistics:**\n\n`;
    response += `• **${totalMembers}** total members\n`;
    response += `• **${activeMembers}** active members\n`;
    response += `• **${expiredMembers}** expired members\n`;
    response += `• **${recentSignups}** new signups this week\n`;
    data = { totalMembers, activeMembers, expiredMembers, recentSignups };
  }
  else if (msg.includes("oil company") || msg.includes("assign")) {
    if (unassignedOil === 0) {
      response = "All active members have an oil company assigned.";
    } else {
      response = `**${unassignedOil} member${unassignedOil > 1 ? "s" : ""}** need oil company assignment:\n\n`;
      needsOilAssignment.forEach((m) => {
        const joined = m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "unknown";
        response += `• ${m.firstName} ${m.lastName} (${m.memberNumber || "no #"}) - joined ${joined}\n`;
      });
      response += `\n→ Go to **Members** and filter by "Missing Oil Company" to assign.`;
    }
    data = { unassignedOil, needsOilAssignment, totalOilCompanies };
  }
  else if (msg.includes("payment") || msg.includes("revenue") || msg.includes("money")) {
    response = `**Payment Overview (Last 30 Days):**\n\n`;
    response += `• **${recentPayments}** successful payments\n`;
    response += `• **${failedCharges}** failed charges needing follow-up\n`;
    response += `• **${pendingManual}** pending manual payments\n`;
    data = { recentPayments, failedCharges, pendingManual };
  }
  else if (msg.includes("help") || msg.includes("what can you")) {
    response = `I can help you with:\n\n`;
    response += `• **"What tasks need attention?"** - See pending tasks\n`;
    response += `• **"Show upcoming renewals"** - View members renewing soon\n`;
    response += `• **"How many members?"** - Member statistics\n`;
    response += `• **"Who needs oil company?"** - Unassigned members\n`;
    response += `• **"Payment overview"** - Recent payment stats\n`;
    response += `• **"System status"** - Overall system health\n`;
  }
  else if (msg.includes("status") || msg.includes("overview") || msg.includes("summary") || msg.includes("dashboard")) {
    const healthScore = totalTasks === 0 ? "Excellent" : totalTasks < 5 ? "Good" : totalTasks < 10 ? "Fair" : "Needs Attention";
    response = `**System Overview:**\n\n`;
    response += `**Health:** ${healthScore}\n\n`;
    response += `**Members:** ${activeMembers} active / ${totalMembers} total\n`;
    response += `**Pending Tasks:** ${totalTasks}\n`;
    response += `**Renewals Next 7 Days:** ${renewingNext7Days}\n`;
    response += `**Oil Companies:** ${totalOilCompanies} active\n`;
    response += `**Recent Signups:** ${recentSignups} this week\n`;
    data = { healthScore, activeMembers, totalMembers, totalTasks, renewingNext7Days, totalOilCompanies, recentSignups };
  }
  else {
    // Default helpful response
    response = `I'm your Oil Co-op admin assistant. Here's a quick overview:\n\n`;
    response += `• **${totalTasks}** tasks need attention\n`;
    response += `• **${activeMembers}** active members\n`;
    response += `• **${renewingNext7Days}** renewals coming up\n\n`;
    response += `Try asking:\n`;
    response += `• "What tasks need my attention?"\n`;
    response += `• "Show upcoming renewals"\n`;
    response += `• "Who needs oil company assignment?"`;
    data = { totalTasks, activeMembers, renewingNext7Days };
  }

  res.json({ response, data, timestamp: new Date().toISOString() });
});

export default router;
