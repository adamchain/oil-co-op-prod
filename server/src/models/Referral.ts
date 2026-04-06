import mongoose, { Schema, type InferSchemaType } from "mongoose";

/** Links a new member to referrer; prevents double credit. */
const referralSchema = new Schema(
  {
    newMemberId: {
      type: Schema.Types.ObjectId,
      ref: "Member",
      required: true,
      unique: true,
    },
    referrerMemberId: {
      type: Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },
    creditedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export type ReferralDoc = InferSchemaType<typeof referralSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Referral =
  mongoose.models.Referral || mongoose.model("Referral", referralSchema);
