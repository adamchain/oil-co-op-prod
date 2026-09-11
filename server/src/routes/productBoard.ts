import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import type { AuthedRequest } from "../middleware/auth.js";
import { ProductBoardItem, PRODUCT_BOARD_PHASES } from "../models/ProductBoardItem.js";

const router = Router();

const createSchema = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().max(1000).optional().default(""),
});

const moveSchema = z.object({
  phase: z.enum(PRODUCT_BOARD_PHASES),
  sortOrder: z.number().int().optional(),
});

router.get("/", async (_req, res) => {
  const items = await ProductBoardItem.find({}).sort({ sortOrder: 1, createdAt: 1 }).lean();
  res.json({ items });
});

router.post("/", async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a title." });
    return;
  }
  const last = (await ProductBoardItem.findOne({ phase: "new" }).sort({ sortOrder: -1 }).select("sortOrder").lean()) as {
    sortOrder?: number;
  } | null;
  const item = await ProductBoardItem.create({
    title: parsed.data.title.trim(),
    notes: parsed.data.notes?.trim() || "",
    phase: "new",
    sortOrder: (last?.sortOrder ?? 0) + 1,
    createdByName: [req.member?.firstName, req.member?.lastName].filter(Boolean).join(" "),
    createdById: req.userId ? new mongoose.Types.ObjectId(req.userId) : null,
  });
  res.status(201).json({ item });
});

router.patch("/:id", async (req: AuthedRequest, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = moveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid phase" });
    return;
  }
  const item = await ProductBoardItem.findById(req.params.id);
  if (!item) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  item.phase = parsed.data.phase;
  if (parsed.data.sortOrder !== undefined) item.sortOrder = parsed.data.sortOrder;
  else {
    const last = (await ProductBoardItem.findOne({ phase: parsed.data.phase, _id: { $ne: item._id } })
      .sort({ sortOrder: -1 })
      .select("sortOrder")
      .lean()) as { sortOrder?: number } | null;
    item.sortOrder = (last?.sortOrder ?? 0) + 1;
  }
  await item.save();
  res.json({ item });
});

export default router;
