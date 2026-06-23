import mongoose, { Schema, type InferSchemaType } from "mongoose";

const referralSourceSchema = new Schema(
  {
    value: { type: String, required: true, trim: true, unique: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type ReferralSourceDoc = InferSchemaType<typeof referralSourceSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const DEFAULT_REFERRAL_SOURCES = ["CCAG", "MEMBER", "OTHER"];

export const ReferralSource =
  mongoose.models.ReferralSource ||
  mongoose.model("ReferralSource", referralSourceSchema);
