import mongoose, { Schema, type InferSchemaType } from "mongoose";

export const EMAIL_TEMPLATE_KEYS = [
  "welcome",
  "renewalReminder",
  "paymentSuccess",
  "paymentFailed",
  "paymentLink",
  "oilCompanyAssigned",
  "auditRequest",
  "insuranceReferral",
  "solarReferral",
  "referralThankYou",
  "referralMilestone",
  "referralPromo",
  "prospectiveInfo",
] as const;

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

const emailTemplateSchema = new Schema(
  {
    key: { type: String, enum: EMAIL_TEMPLATE_KEYS, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    subject: { type: String, required: true, trim: true },
    html: { type: String, required: true },
    text: { type: String, default: "" },
    variables: { type: [String], default: [] },
  },
  { timestamps: true }
);

export type EmailTemplateDoc = InferSchemaType<typeof emailTemplateSchema> & {
  _id: mongoose.Types.ObjectId;
  key: EmailTemplateKey;
};

export const EmailTemplate =
  mongoose.models.EmailTemplate ||
  mongoose.model("EmailTemplate", emailTemplateSchema);
