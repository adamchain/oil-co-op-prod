import mongoose, { Schema, type InferSchemaType } from "mongoose";

const communicationLogSchema = new Schema(
  {
    memberId: { type: Schema.Types.ObjectId, ref: "Member", required: true },
    channel: {
      type: String,
      enum: ["email", "sms", "letter_queue", "oil_company_email"],
      required: true,
    },
    subject: { type: String, default: "" },
    bodyPreview: { type: String, default: "" },
    status: {
      type: String,
      enum: ["sent", "queued", "failed", "skipped_no_contact"],
      default: "sent",
    },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

communicationLogSchema.index({ memberId: 1, createdAt: -1 });

export type CommunicationLogDoc = InferSchemaType<typeof communicationLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const CommunicationLog =
  mongoose.models.CommunicationLog ||
  mongoose.model("CommunicationLog", communicationLogSchema);
