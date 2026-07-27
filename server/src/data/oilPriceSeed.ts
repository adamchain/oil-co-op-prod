/**
 * Recent weekly prices from oilco-op.com/services/heating-prices/ (as of 2026-07-26).
 * State averages stopped appearing after March 2026 (EIA season window).
 * weekOf is YYYY-MM-DD; display as MM/DD/YY on the site.
 */
export type OilPriceSeedRow = {
  weekOf: string;
  coopPrice: number;
  statePrice?: number | null;
  season?: number | null;
};

export const OIL_PRICE_SEED: OilPriceSeedRow[] = [
  { weekOf: "2026-07-20", coopPrice: 4.565, season: 26 },
  { weekOf: "2026-07-14", coopPrice: 4.32, season: 26 },
  { weekOf: "2026-07-06", coopPrice: 3.75, season: 26 },
  { weekOf: "2026-06-29", coopPrice: 3.631, season: 26 },
  { weekOf: "2026-06-22", coopPrice: 3.565, season: 26 },
  { weekOf: "2026-06-15", coopPrice: 3.625, season: 26 },
  { weekOf: "2026-06-08", coopPrice: 4.14, season: 26 },
  { weekOf: "2026-06-01", coopPrice: 4.221, season: 26 },
  { weekOf: "2026-05-25", coopPrice: 4.142, season: 26 },
  { weekOf: "2026-05-18", coopPrice: 4.454, season: 26 },
  { weekOf: "2026-05-11", coopPrice: 4.501, season: 26 },
  { weekOf: "2026-05-04", coopPrice: 4.421, season: 26 },
  { weekOf: "2026-04-27", coopPrice: 4.511, season: 26 },
  { weekOf: "2026-04-20", coopPrice: 4.319, season: 26 },
  { weekOf: "2026-04-13", coopPrice: 4.319, season: 26 },
  { weekOf: "2026-04-06", coopPrice: 4.791, season: 26 },
  { weekOf: "2026-03-30", coopPrice: 4.834, statePrice: 5.546, season: 26 },
  { weekOf: "2026-03-23", coopPrice: 4.812, statePrice: 5.601, season: 26 },
  { weekOf: "2026-03-16", coopPrice: 4.693, statePrice: 5.166, season: 26 },
  { weekOf: "2026-03-09", coopPrice: 4.344, statePrice: 5.107, season: 26 },
];

export function computePriceDifference(
  coopPrice: number,
  statePrice: number | null | undefined
): number | null {
  if (statePrice == null || !Number.isFinite(statePrice)) return null;
  return Math.round((statePrice - coopPrice) * 1000) / 1000;
}
