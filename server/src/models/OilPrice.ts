import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * Weekly heating-oil price row (mirrors legacy OilPrices table on oilco-op.com).
 * Current hero price = newest row by weekOf.
 */
const oilPriceSchema = new Schema(
  {
    /** Week-of date as YYYY-MM-DD (unique). */
    weekOf: { type: String, required: true, unique: true, trim: true },
    /** Average Co-op price per gallon. */
    coopPrice: { type: Number, required: true },
    /** State average (US EIA, typically Oct–Mar). Null when unavailable. */
    statePrice: { type: Number, default: null },
    /** statePrice − coopPrice when both present; otherwise null. */
    priceDifference: { type: Number, default: null },
    /** Heating season year label (e.g. 26 for 2025–26). */
    season: { type: Number, default: null },
    /** Legacy flag: first posted week of the calendar month. */
    firstOfMonth: { type: Boolean, default: false },
  },
  { timestamps: true }
);

oilPriceSchema.index({ weekOf: -1 });

export type OilPriceDoc = InferSchemaType<typeof oilPriceSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const OilPrice = mongoose.models.OilPrice || mongoose.model("OilPrice", oilPriceSchema);
