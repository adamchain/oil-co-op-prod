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
    // Built-in templates use one of EMAIL_TEMPLATE_KEYS; custom (staff-created)
    // templates use a generated key and set custom: true so they can be deleted.
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    enabled: { type: Boolean, default: true },
    custom: { type: Boolean, default: false },
    subject: { type: String, required: true, trim: true },
    html: { type: String, required: true },
    text: { type: String, default: "" },
    variables: { type: [String], default: [] },
  },
  { timestamps: true }
);

export type EmailTemplateDoc = InferSchemaType<typeof emailTemplateSchema> & {
  _id: mongoose.Types.ObjectId;
  key: string;
};

export const EmailTemplate =
  mongoose.models.EmailTemplate ||
  mongoose.model("EmailTemplate", emailTemplateSchema);
