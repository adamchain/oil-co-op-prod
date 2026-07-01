import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { DEFAULT_EMAIL_BRANDING } from "../services/emailTemplates.js";

/**
 * Single-document store for the outbound email header/footer design, edited in
 * Admin → Email Templates ("Header & Footer Designer"). The `singleton` field is
 * unique so there is always exactly one branding record.
 */
const emailBrandingSchema = new Schema(
  {
    singleton: { type: String, default: "email-branding", unique: true },
    headerBgColor: { type: String, default: DEFAULT_EMAIL_BRANDING.headerBgColor, trim: true },
    headerTextColor: { type: String, default: DEFAULT_EMAIL_BRANDING.headerTextColor, trim: true },
    headerTitle: { type: String, default: DEFAULT_EMAIL_BRANDING.headerTitle, trim: true },
    headerShowLogo: { type: Boolean, default: DEFAULT_EMAIL_BRANDING.headerShowLogo },
    footerBgColor: { type: String, default: DEFAULT_EMAIL_BRANDING.footerBgColor, trim: true },
    footerTitleColor: { type: String, default: DEFAULT_EMAIL_BRANDING.footerTitleColor, trim: true },
    footerTextColor: { type: String, default: DEFAULT_EMAIL_BRANDING.footerTextColor, trim: true },
    footerTitle: { type: String, default: DEFAULT_EMAIL_BRANDING.footerTitle, trim: true },
    footerText: { type: String, default: DEFAULT_EMAIL_BRANDING.footerText, trim: true },
  },
  { timestamps: true }
);

export type EmailBrandingDoc = InferSchemaType<typeof emailBrandingSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const EmailBranding =
  mongoose.models.EmailBranding ||
  mongoose.model("EmailBranding", emailBrandingSchema);
