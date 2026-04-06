import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { requireAuth, requireAdmin, type AuthedRequest } from "../middleware/auth.js";
import { Member } from "../models/Member.js";
import { OilCompany } from "../models/OilCompany.js";
import { BillingEvent } from "../models/BillingEvent.js";
import { ActivityLog } from "../models/ActivityLog.js";
import { CommunicationLog } from "../models/CommunicationLog.js";
import { Referral } from "../models/Referral.js";
import { logActivity } from "../services/activity.js";
import { sendMemberEmail } from "../services/mail.js";
import { nextJuneFirstAfterSignup } from "../utils/juneBilling.js";
import bcrypt from "bcryptjs";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/members", async (req, res) => {
  const q = (req.query.q as string) || "";
  const status = req.query.status as string | undefined;
  const filter: Record<string, unknown> = { role: "member" };
  if (status && ["active", "expired", "cancelled"].includes(status)) {
    filter.status = status;
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

export default router;
