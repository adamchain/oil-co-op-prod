import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { Member } from "../models/Member.js";
import { logActivity } from "../services/activity.js";

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
  if (body.phone !== undefined) m.phone = body.phone;
  if (body.addressLine1 !== undefined) m.addressLine1 = body.addressLine1;
  if (body.addressLine2 !== undefined) m.addressLine2 = body.addressLine2;
  if (body.city !== undefined) m.city = body.city;
  if (body.state !== undefined) m.state = body.state;
  if (body.postalCode !== undefined) m.postalCode = body.postalCode;
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
      legacyProfile: m.legacyProfile || {},
    },
  });
});

export default router;
