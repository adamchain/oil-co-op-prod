import { Router } from "express";
import { CommunityPartner } from "../models/CommunityPartner.js";
import { CommunityEvent } from "../models/CommunityEvent.js";
import { ensureCommunityContent } from "../services/communityStore.js";

const router = Router();

router.get("/partners", async (_req, res) => {
  await ensureCommunityContent();
  const partners = await CommunityPartner.find({ active: true }).sort({ sortOrder: 1, name: 1 }).lean();
  res.json({ partners });
});

router.get("/events", async (_req, res) => {
  await ensureCommunityContent();
  const events = await CommunityEvent.find({ active: true }).sort({ sortOrder: 1, eventDate: -1 }).lean();
  res.json({
    upcoming: events.filter((e) => e.kind === "upcoming"),
    recent: events.filter((e) => e.kind === "recent"),
    events,
  });
});

export default router;
