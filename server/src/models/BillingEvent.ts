import mongoose, { Schema, type InferSchemaType } from "mongoose";

const billingEventSchema = new Schema(
  {
    memberId: { type: Schema.Types.ObjectId, ref: "Member", required: true },
    kind: {
      type: String,
      enum: ["registration", "annual", "manual_adjustment"],
      required: true,
    },
    amountCents: { type: Number, required: true },
    stripePaymentIntentId: { type: String, default: "" },
    /** Authorize.Net transaction id for phone/admin card charges. */
    authnetTransactionId: { type: String, default: "" },
    authnetAuthCode: { type: String, default: "" },
    cardLast4: { type: String, default: "" },
    cardType: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "succeeded", "failed", "waived", "mock"],
      required: true,
    },
    description: { type: String, default: "" },
    billingYear: { type: Number, default: null },
    processedByAdminId: { type: Schema.Types.ObjectId, ref: "Member", default: null },
  },
  { timestamps: true }
);

billingEventSchema.index({ memberId: 1, createdAt: -1 });

export type BillingEventDoc = InferSchemaType<typeof billingEventSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const BillingEvent =
  mongoose.models.BillingEvent || mongoose.model("BillingEvent", billingEventSchema);
