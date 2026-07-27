import { OilPrice } from "../models/OilPrice.js";
import { OIL_PRICE_SEED, computePriceDifference } from "../data/oilPriceSeed.js";

/** Insert seed rows when the collection is empty (first deploy / local). */
export async function ensureOilPrices(): Promise<void> {
  const count = await OilPrice.estimatedDocumentCount();
  if (count > 0) return;

  await OilPrice.insertMany(
    OIL_PRICE_SEED.map((row) => ({
      weekOf: row.weekOf,
      coopPrice: row.coopPrice,
      statePrice: row.statePrice ?? null,
      priceDifference: computePriceDifference(row.coopPrice, row.statePrice),
      season: row.season ?? null,
      firstOfMonth: false,
    })),
    { ordered: false }
  ).catch(() => {
    /* ignore duplicate-key races on concurrent boot */
  });
}
