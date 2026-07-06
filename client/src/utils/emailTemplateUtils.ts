/** Shared helpers for admin email templates (Email Templates page + Mailings tab). */

export type EmailTemplateInfo = {
  _id: string;
  key: string;
  name: string;
  description: string;
  enabled?: boolean;
  custom?: boolean;
  subject: string;
  html: string;
  text: string;
  variables: string[];
};

/** Display order for template pickers (matches Email Templates admin page). */
export const EMAIL_TEMPLATE_ORDER = [
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

export function applyTemplateVariables(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_m, variableName: string) => {
    const value = data[variableName];
    return value === undefined || value === null ? "" : String(value);
  });
}

export function orderedTemplateKeys(templates: Record<string, EmailTemplateInfo>): string[] {
  const known = EMAIL_TEMPLATE_ORDER.filter((k) => templates[k]);
  const extras = Object.keys(templates).filter((k) => !EMAIL_TEMPLATE_ORDER.includes(k as (typeof EMAIL_TEMPLATE_ORDER)[number]));
  return [...known, ...extras];
}

/** Parse optional contact/address lines from oil company notes (e.g. "Contact: Jane | Address: 1 Main St"). */
export function parseOilCompanyNotes(notes?: string): { contactName: string; companyAddress: string } {
  const text = String(notes ?? "");
  return {
    contactName: text.match(/Contact:\s*([^\n|]+)/i)?.[1]?.trim() || "",
    companyAddress: text.match(/Address:\s*([^\n|]+)/i)?.[1]?.trim() || "",
  };
}
