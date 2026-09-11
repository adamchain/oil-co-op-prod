import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { Member } from "../models/Member.js";
import { logActivity } from "../services/activity.js";
import { addPropertyToMember, serializeProperties } from "../services/accountLookup.js";
import { storeCardOnFile, removeCardOnFile } from "../services/storeCardOnFile.js";
import { phoneDigits } from "../utils/phone.js";

const router = Router();

const notificationSchema = z.object({
  emailEnabled: z.boolean().optional(),
  renewalReminders: z.boolean().optional(),
  billingNotices: z.boolean().optional(),
  oilCompanyUpdates: z.boolean().optional(),
  marketing: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  smsPhone: z.string().optional(),
});

const profileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  legacyProfile: z.record(z.string(), z.unknown()).optional(),
});

const propertySchema = z.object({
  label: z.string().optional().default(""),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional().default(""),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
});

router.patch("/notification-settings", requireAuth, async (req: AuthedRequest, res) => {
  if (req.member!.role !== "member") {
    res.status(403).json({ error: "Members only" });
    return;
  }
  const parsed = notificationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const m = await Member.findById(req.userId);
  if (!m) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  m.notificationSettings = {
    ...m.notificationSettings,
    ...parsed.data,
  };
  await m.save();
  await logActivity(m._id, "notification_settings_updated", parsed.data, m._id);
  res.json({ notificationSettings: m.notificationSettings });
});

router.patch("/profile", requireAuth, async (req: AuthedRequest, res) => {
  if (req.member!.role === "member") {
    res.status(403).json({ error: "Email the office to update your contact information." });
    return;
  }
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const m = await Member.findById(req.userId);
  if (!m) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const body = parsed.data;
  if (body.firstName !== undefined) m.firstName = body.firstName;
  if (body.lastName !== undefined) m.lastName = body.lastName;
  if (body.phone !== undefined) {
    m.phone = body.phone;
    m.phoneDigits = phoneDigits(body.phone);
  }
  if (body.addressLine1 !== undefined) m.addressLine1 = body.addressLine1;
  if (body.addressLine2 !== undefined) m.addressLine2 = body.addressLine2;
  if (body.city !== undefined) m.city = body.city;
  if (body.state !== undefined) m.state = body.state;
  if (body.postalCode !== undefined) m.postalCode = body.postalCode;

  // Keep the primary property row in sync when the top-level home address changes.
  if (
    body.addressLine1 !== undefined ||
    body.addressLine2 !== undefined ||
    body.city !== undefined ||
    body.state !== undefined ||
    body.postalCode !== undefined
  ) {
    if (!Array.isArray(m.properties)) m.properties = [] as typeof m.properties;
    const primary =
      m.properties.find((p: { isPrimary?: boolean }) => p.isPrimary) ?? m.properties[0];
    if (primary) {
      if (body.addressLine1 !== undefined) primary.addressLine1 = body.addressLine1;
      if (body.addressLine2 !== undefined) primary.addressLine2 = body.addressLine2;
      if (body.city !== undefined) primary.city = body.city;
      if (body.state !== undefined) primary.state = body.state;
      if (body.postalCode !== undefined) primary.postalCode = body.postalCode;
      primary.isPrimary = true;
    } else if (m.addressLine1) {
      m.properties.push({
        label: "Primary",
        addressLine1: m.addressLine1,
        addressLine2: m.addressLine2 || "",
        city: m.city || "",
        state: m.state || "",
        postalCode: m.postalCode || "",
        isPrimary: true,
      });
    }
  }

  if (body.legacyProfile !== undefined) {
    m.legacyProfile = {
      ...(typeof m.legacyProfile === "object" && m.legacyProfile ? m.legacyProfile : {}),
      ...body.legacyProfile,
    };
  }
  await m.save();
  await logActivity(m._id, "member_profile_updated", body, m._id);
  res.json({
    member: {
      id: String(m._id),
      firstName: m.firstName,
      lastName: m.lastName,
      phone: m.phone,
      addressLine1: m.addressLine1,
      addressLine2: m.addressLine2,
      city: m.city,
      state: m.state,
      postalCode: m.postalCode,
      properties: serializeProperties(m),
      legacyProfile: m.legacyProfile || {},
    },
  });
});

const storeCardSchema = z.object({
  cardNumber: z.string().min(12),
  expiration: z.string().min(4),
  cvv: z.string().min(3),
});

/** Member self-service: vault a credit/debit card (Authorize.Net CIM). PAN is never stored. */
router.post("/card", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = storeCardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const m = await Member.findById(req.userId);
  if (!m) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const result = await storeCardOnFile(m, parsed.data);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  await m.save();
  await logActivity(m._id, "member_card_stored", { cardLast4: result.cardLast4 }, m._id);
  res.json({
    ok: true,
    cardLast4: result.cardLast4,
    cardOnFile: true,
  });
});

router.delete("/card", requireAuth, async (req: AuthedRequest, res) => {
  const m = await Member.findById(req.userId);
  if (!m) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const result = await removeCardOnFile(m);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  await m.save();
  await logActivity(m._id, "member_card_removed", {}, m._id);
  res.json({ ok: true, cardLast4: "", cardOnFile: false });
});

router.post("/properties", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = propertySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const m = await Member.findById(req.userId);
  if (!m) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const properties = await addPropertyToMember(m, parsed.data);
  await logActivity(m._id, "member_property_added", parsed.data, m._id);
  res.status(201).json({ properties });
});

export default router;
