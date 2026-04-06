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

export default router;
