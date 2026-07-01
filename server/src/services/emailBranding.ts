import { EmailBranding } from "../models/EmailBranding.js";
import {
  DEFAULT_EMAIL_BRANDING,
  type EmailBranding as EmailBrandingConfig,
} from "./emailTemplates.js";

/**
 * Reads the saved email header/footer branding, falling back to defaults for
 * any field that is missing. Always returns a complete config so callers
 * (wrapEmail, preview endpoints) never have to null-check.
 */
export async function getEmailBranding(): Promise<EmailBrandingConfig> {
  const doc = (await EmailBranding.findOne({ singleton: "email-branding" }).lean()) as
    | Partial<EmailBrandingConfig>
    | null;
  if (!doc) return { ...DEFAULT_EMAIL_BRANDING };
  return {
    headerBgColor: doc.headerBgColor ?? DEFAULT_EMAIL_BRANDING.headerBgColor,
    headerTextColor: doc.headerTextColor ?? DEFAULT_EMAIL_BRANDING.headerTextColor,
    headerTitle: doc.headerTitle ?? DEFAULT_EMAIL_BRANDING.headerTitle,
    headerShowLogo: doc.headerShowLogo ?? DEFAULT_EMAIL_BRANDING.headerShowLogo,
    footerBgColor: doc.footerBgColor ?? DEFAULT_EMAIL_BRANDING.footerBgColor,
    footerTitleColor: doc.footerTitleColor ?? DEFAULT_EMAIL_BRANDING.footerTitleColor,
    footerTextColor: doc.footerTextColor ?? DEFAULT_EMAIL_BRANDING.footerTextColor,
    footerTitle: doc.footerTitle ?? DEFAULT_EMAIL_BRANDING.footerTitle,
    footerText: doc.footerText ?? DEFAULT_EMAIL_BRANDING.footerText,
  };
}
