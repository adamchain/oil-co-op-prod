import { Router } from "express";
import { OilPrice } from "../models/OilPrice.js";
import { ensureOilPrices } from "../services/oilPriceStore.js";

const router = Router();

type OilPriceLean = {
  _id: { toString(): string };
  weekOf: string;
  coopPrice: number;
  statePrice?: number | null;
  priceDifference?: number | null;
  season?: number | null;
  firstOfMonth?: boolean;
};

function serialize(doc: OilPriceLean) {
  return {
    _id: doc._id.toString(),
    weekOf: doc.weekOf,
    coopPrice: doc.coopPrice,
    statePrice: doc.statePrice ?? null,
    priceDifference: doc.priceDifference ?? null,
    season: doc.season ?? null,
    firstOfMonth: Boolean(doc.firstOfMonth),
  };
}

/** Latest weekly Co-op price for the marketing hero. */
router.get("/current", async (_req, res) => {
  await ensureOilPrices();
  const row = (await OilPrice.findOne().sort({ weekOf: -1 }).lean()) as OilPriceLean | null;
  if (!row) {
    res.status(404).json({ error: "No oil prices published yet" });
    return;
  }
  res.json({ oilPrice: serialize(row) });
});

/** Historical list (newest first). Optional ?limit= (default 50, max 500). */
router.get("/", async (req, res) => {
  await ensureOilPrices();
  const rawLimit = Number(req.query.limit ?? 50);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 500) : 50;
  const page = Math.max(1, Math.floor(Number(req.query.page ?? 1)) || 1);
  const skip = (page - 1) * limit;

  const [total, rawRows] = await Promise.all([
    OilPrice.countDocuments(),
    OilPrice.find().sort({ weekOf: -1 }).skip(skip).limit(limit).lean(),
  ]);
  const rows = rawRows as unknown as OilPriceLean[];

  res.json({
    oilPrices: rows.map(serialize),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

export default router;
