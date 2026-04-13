import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * PaymentToken - Temporary tokens for payment links sent via email
 *
 * When a member needs to pay manually (e.g., failed auto-charge, check-payer),
 * we generate a unique token that allows them to complete payment without logging in.
 */
const paymentTokenSchema = new Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    memberId: { type: Schema.Types.ObjectId, ref: "Member", required: true },
    amountCents: { type: Number, required: true },
    kind: {
      type: String,
      enum: ["annual", "registration"],
      default: "annual",
    },
    billingYear: { type: Number },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    /** Authorize.Net transaction ID if payment completed */
    transactionId: { type: String, default: "" },
  },
  { timestamps: true }
);

// Auto-expire old tokens
paymentTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PaymentTokenDoc = InferSchemaType<typeof paymentTokenSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PaymentToken =
  mongoose.models.PaymentToken || mongoose.model("PaymentToken", paymentTokenSchema);
