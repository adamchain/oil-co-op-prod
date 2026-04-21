import { EmailTemplate, type EmailTemplateKey, EMAIL_TEMPLATE_KEYS } from "../models/EmailTemplate.js";

type TemplateDefinition = {
  name: string;
  description: string;
  subject: string;
  variables: string[];
  html: string;
  text: string;
};

const TEMPLATE_DEFINITIONS: Record<EmailTemplateKey, TemplateDefinition> = {
  welcome: {
    name: "Welcome Email",
    description: "Sent when a new member signs up",
    subject: "Welcome to Citizen's Oil Co-op",
    variables: ["firstName", "memberNumber", "nextBillingDate"],
    html: "<h2>Welcome to the Co-op, {firstName}!</h2><p>Your member number is {memberNumber}.</p><p>Next annual billing date: {nextBillingDate}</p>",
    text: "Hi {firstName}, your member number is {memberNumber}. Next annual billing date: {nextBillingDate}.",
  },
  renewalReminder: {
    name: "Renewal Reminder",
    description: "Sent 30, 7, and 1 day(s) before annual billing",
    subject: "Annual membership renewal - {daysUntil} days",
    variables: ["firstName", "daysUntil", "billingDate", "amount", "isAutoRenew", "cardLast4"],
    html: "<h2>Membership Renewal Reminder</h2><p>Hello {firstName}, your annual fee of {amount} will be billed in {daysUntil} days on {billingDate}.</p><p>Auto-renew: {isAutoRenew}. Card: {cardLast4}</p>",
    text: "Hello {firstName}, your annual fee of {amount} will be billed in {daysUntil} days on {billingDate}. Auto-renew: {isAutoRenew}. Card: {cardLast4}.",
  },
  paymentSuccess: {
    name: "Payment Success",
    description: "Sent after successful payment",
    subject: "Payment received - Oil Co-op membership",
    variables: ["firstName", "amount", "transactionId", "cardLast4", "billingYear"],
    html: "<h2>Payment Received</h2><p>Hello {firstName}, we received your payment of {amount}.</p><p>Card: ****{cardLast4} | Transaction: {transactionId} | Billing Year: {billingYear}</p>",
    text: "Hello {firstName}, we received your payment of {amount}. Card: ****{cardLast4}. Transaction: {transactionId}. Billing Year: {billingYear}.",
  },
  paymentFailed: {
    name: "Payment Failed",
    description: "Sent when auto-charge fails",
    subject: "Payment failed - Action required",
    variables: ["firstName", "amount", "reason"],
    html: "<h2>Payment Failed</h2><p>Hello {firstName}, we could not process your payment of {amount}.</p><p>Reason: {reason}</p>",
    text: "Hello {firstName}, we could not process your payment of {amount}. Reason: {reason}.",
  },
  paymentLink: {
    name: "Payment Link",
    description: "Manual payment link sent by admin",
    subject: "Pay your Oil Co-op membership - {amount}",
    variables: ["firstName", "amount", "paymentUrl", "expiresAt"],
    html: "<h2>Payment Link</h2><p>Hello {firstName}, pay your membership fee of {amount} here: <a href=\"{paymentUrl}\">{paymentUrl}</a>.</p><p>Link expires on {expiresAt}.</p>",
    text: "Hello {firstName}, pay your membership fee of {amount} at {paymentUrl}. Link expires on {expiresAt}.",
  },
  oilCompanyAssigned: {
    name: "Oil Company Assigned",
    description: "Sent when admin assigns oil company",
    subject: "Your oil company has been assigned",
    variables: ["firstName", "companyName", "companyPhone"],
    html: "<h2>Oil Company Assigned</h2><p>Hello {firstName}, your membership is linked to {companyName}.</p><p>Phone: {companyPhone}</p>",
    text: "Hello {firstName}, your membership is linked to {companyName}. Phone: {companyPhone}.",
  },
};

export function getTemplateDefinitions() {
  return TEMPLATE_DEFINITIONS;
}

export async function ensureEmailTemplates(): Promise<void> {
  for (const key of EMAIL_TEMPLATE_KEYS) {
    const exists = await EmailTemplate.exists({ key });
    if (exists) continue;
    const d = TEMPLATE_DEFINITIONS[key];
    await EmailTemplate.create({
      key,
      name: d.name,
      description: d.description,
      subject: d.subject,
      text: d.text,
      html: d.html,
      variables: d.variables,
    });
  }
}

export function applyTemplateVariables(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_m, variableName: string) => {
    const value = data[variableName];
    return value === undefined || value === null ? "" : String(value);
  });
}
