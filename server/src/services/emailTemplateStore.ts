import { EmailTemplate, type EmailTemplateKey, EMAIL_TEMPLATE_KEYS } from "../models/EmailTemplate.js";

type TemplateDefinition = {
  name: string;
  description: string;
  subject: string;
  variables: string[];
  html: string;
  text: string;
};

// Bodies are MIDDLE CONTENT ONLY. Outbound emails get the forest-green banner
// with the COOP logo and a simple footer at send time. Printed letters in the
// workbench use the separate letterhead layout — templates must not repeat a
// greeting or sign-off; staff only customize the message in the middle.
const TEMPLATE_DEFINITIONS: Record<EmailTemplateKey, TemplateDefinition> = {
  welcome: {
    name: "Welcome Email",
    description: "Sent when a new member signs up",
    subject: "Welcome to Citizen's Oil Co-op",
    variables: ["firstName", "memberNumber", "nextBillingDate"],
    html:
      '<p style="font-size:22px;font-weight:700;color:#14703B;margin:0 0 16px;">Welcome to the Co-op, {firstName}!</p>' +
      "<p>Thank you for joining Citizen's Oil Co-op. Your membership is now active.</p>" +
      '<table style="background-color:#fafaf9;border-radius:6px;padding:16px;margin:16px 0;width:100%;">' +
      "<tr><td style=\"padding:8px 0;\"><strong>Member Number:</strong></td><td style=\"padding:8px 0;\">{memberNumber}</td></tr>" +
      "<tr><td style=\"padding:8px 0;\"><strong>Next Annual Bill:</strong></td><td style=\"padding:8px 0;\">{nextBillingDate}</td></tr>" +
      "</table>" +
      "<p><strong>What happens next?</strong></p>" +
      "<ul><li>Our staff will assign you to a participating oil company within 1-2 business days.</li>" +
      "<li>Your annual membership renews each June 1st.</li></ul>" +
      "<p>If you have any questions, don't hesitate to contact our office.</p>",
    text:
      "Welcome to the Co-op, {firstName}!\n\n" +
      "Thank you for joining Citizen's Oil Co-op. Your membership is now active.\n\n" +
      "Member Number: {memberNumber}\nNext Annual Bill: {nextBillingDate}\n\n" +
      "Our staff will assign you to a participating oil company within 1-2 business days. Your membership renews each June 1st.",
  },
  renewalReminder: {
    name: "Renewal Reminder",
    description: "Annual renewal reminder (sent manually by staff)",
    subject: "Annual membership renewal - {daysUntil} days",
    variables: ["daysUntil", "billingDate", "amount", "isAutoRenew", "cardLast4"],
    html: "<p>Your annual Oil Co-op membership fee of <strong>{amount}</strong> will be billed in {daysUntil} days on {billingDate}.</p><p>Auto-renew: {isAutoRenew}. Card on file: {cardLast4}.</p>",
    text: "Your annual Oil Co-op membership fee of {amount} will be billed in {daysUntil} days on {billingDate}.\n\nAuto-renew: {isAutoRenew}. Card on file: {cardLast4}.",
  },
  paymentSuccess: {
    name: "Payment Success",
    description: "Receipt after a successful payment",
    subject: "Payment received - Oil Co-op membership",
    variables: ["amount", "transactionId", "cardLast4", "billingYear"],
    html: "<p>Thank you! We received your annual membership payment of <strong>{amount}</strong>.</p><p>Card: ****{cardLast4} | Transaction: {transactionId} | Billing Year: {billingYear}</p>",
    text: "Thank you! We received your annual membership payment of {amount}.\n\nCard: ****{cardLast4}. Transaction: {transactionId}. Billing Year: {billingYear}.",
  },
  paymentFailed: {
    name: "Payment Failed",
    description: "Notice that a payment could not be processed",
    subject: "Payment failed - Action required",
    variables: ["amount", "reason"],
    html: "<p>We were unable to process your annual membership payment of <strong>{amount}</strong>.</p><p>Reason: {reason}</p><p>Please call our office to update your card on file or arrange an alternative payment method.</p>",
    text: "We were unable to process your annual membership payment of {amount}.\n\nReason: {reason}\n\nPlease call our office to update your card on file or arrange an alternative payment method.",
  },
  paymentLink: {
    name: "Payment Link",
    description: "Manual payment link sent by admin",
    subject: "Pay your Oil Co-op membership - {amount}",
    variables: ["amount", "paymentUrl", "expiresAt"],
    html: "<p>You can pay your annual membership fee of <strong>{amount}</strong> here: <a href=\"{paymentUrl}\">{paymentUrl}</a>.</p><p>This link expires on {expiresAt}.</p>",
    text: "You can pay your annual membership fee of {amount} here: {paymentUrl}\n\nThis link expires on {expiresAt}.",
  },
  oilCompanyAssigned: {
    name: "Oil Company Assigned",
    description: "Assignment notice after a company is selected",
    subject: "Welcome to Citizen's Oil Co-op - {companyName}",
    variables: ["companyName", "companyPhone", "contactName", "companyAddress"],
    html:
      "<p>Thank you for joining the Citizen's Oil Co-op. Welcome!</p>" +
      "<p>We have forwarded your information to <strong>{companyName}</strong>. " +
      "A representative will be in touch soon to set up your account and discuss delivery/service.</p>" +
      "<p>You will be coded as an Oil Co-op member to receive discounted pricing.</p>" +
      "<p><strong>Primary contact:</strong> {contactName}<br>" +
      "<strong>Phone:</strong> {companyPhone}<br>" +
      "<strong>Address:</strong> {companyAddress}</p>" +
      "<p>Please remember to cancel any existing service or deliveries you have with another supplier.</p>",
    text:
      "Thank you for joining the Citizen's Oil Co-op. Welcome!\n\n" +
      "We have forwarded your information to {companyName}. A representative will contact you soon to set up your account and discuss delivery/service.\n\n" +
      "Primary contact: {contactName}\n" +
      "Phone: {companyPhone}\n" +
      "Address: {companyAddress}\n\n" +
      "Please remember to cancel existing service with any prior supplier.",
  },
  auditRequest: {
    name: "Audit Request",
    description: "Member requested an energy audit",
    subject: "Your Energy Audit Request - Citizen's Oil Co-op",
    variables: ["partnerName", "partnerPhone"],
    html:
      "<p>Thank you for your interest in an energy audit.</p>" +
      "<p>We have partnered with {partnerName} for audits. The current co-pay is $50.</p>" +
      "<p>If you would like to move forward, contact {partnerName} at {partnerPhone} and mention the Co-op. " +
      "We have also shared your information with them so they can reach out.</p>" +
      "<p>Please let us know if we can help with anything else.</p>",
    text:
      "Thank you for your interest in an energy audit.\n\n" +
      "We partner with {partnerName}. Current co-pay is $50.\n" +
      "Please contact {partnerName} at {partnerPhone} and mention the Co-op. We have also shared your information with them.\n\n" +
      "Please let us know if we can help with anything else.",
  },
  insuranceReferral: {
    name: "Insurance Referral",
    description: "Member asked for insurance quote referral",
    subject: "Insurance Quote Referral - Citizen's Oil Co-op",
    variables: ["contactName", "contactEmail"],
    html:
      "<p>Thank you for your interest in an insurance quote through the Co-op.</p>" +
      "<p>We have forwarded your contact information to our insurance partner. " +
      "You may also reach out directly to {contactName} at {contactEmail}.</p>" +
      "<p>Please let us know if we can be of additional assistance.</p>",
    text:
      "Thank you for your interest in an insurance quote through the Co-op.\n\n" +
      "We have forwarded your information to our insurance partner. You can also contact {contactName} at {contactEmail}.\n\n" +
      "Please let us know if we can be of additional assistance.",
  },
  solarReferral: {
    name: "Solar Referral",
    description: "Member asked for solar consultation referral",
    subject: "Solar Consultation Referral - Citizen's Oil Co-op",
    variables: ["contactName", "contactEmail", "contactPhone"],
    html:
      "<p>Thank you for your interest in a solar consultation through the Co-op.</p>" +
      "<p>We have forwarded your information to {contactName}. They will contact you shortly.</p>" +
      "<p>You can also reach out directly at {contactEmail} or {contactPhone}.</p>" +
      "<p>Members receive a $500 check upon installation/activation through our partner.</p>" +
      "<p>Please let us know if we can be of additional assistance.</p>",
    text:
      "Thank you for your interest in a solar consultation.\n\n" +
      "We have forwarded your information to {contactName}. They will be in touch shortly.\n" +
      "Direct contact: {contactEmail} / {contactPhone}\n\n" +
      "Members receive a $500 check upon installation/activation.\n\n" +
      "Please let us know if we can be of additional assistance.",
  },
  referralThankYou: {
    name: "Referral Thank You",
    description: "Standard thank-you email for a successful referral",
    subject: "Thank You for Supporting the Co-op",
    variables: ["referredMemberName", "membershipSeason"],
    html:
      "<p>I am writing today to say thank you for your support of the Co-op. We appreciate you spreading the word about the program!</p>" +
      "<p>We were happy to welcome {referredMemberName} to the Citizen's Oil Co-op. " +
      "As a result, we have waived your membership fees for the {membershipSeason} heating season.</p>" +
      "<p>Remember: with a total of 5 referrals, you become a Lifetime Member (no more membership fees).</p>",
    text:
      "I am writing today to say thank you for your support of the Co-op.\n\n" +
      "We were happy to welcome {referredMemberName} to the Citizen's Oil Co-op. As a result, we have waived your membership fees for the {membershipSeason} heating season.\n\n" +
      "Remember: with 5 total referrals you become a Lifetime Member (no more membership fees).",
  },
  referralMilestone: {
    name: "Referral Milestone",
    description: "Referral thank-you variant for multiple referrals",
    subject: "Referral Milestone Update",
    variables: ["referredMemberNames", "referralCount"],
    html:
      "<p>Thank you for supporting the Co-op and spreading the word about our program.</p>" +
      "<p>We were happy to welcome {referredMemberNames} to the Citizen's Oil Co-op.</p>" +
      "<p>Your membership fee has been waived for next heating season, and you now have {referralCount} total referrals toward Lifetime Membership.</p>",
    text:
      "Thank you for supporting the Co-op.\n\n" +
      "We were happy to welcome {referredMemberNames}.\n" +
      "Your membership fee has been waived for next season and you now have {referralCount} referrals toward Lifetime Membership.",
  },
  referralPromo: {
    name: "Referral Promo",
    description: "Promo-specific referral thank-you version",
    subject: "Congratulations on Your Referral Reward",
    variables: ["referredMemberName", "promoName", "membershipSeason"],
    html:
      "<p>Congratulations! We have waived your membership fee for the {membershipSeason} heating season with your referral.</p>" +
      "<p>Thank you for your support of the Co-op and for taking advantage of our {promoName} offer. " +
      "We were happy to welcome {referredMemberName} to the Citizen's Oil Co-op.</p>",
    text:
      "Congratulations! We have waived your membership fee for the {membershipSeason} heating season with your referral.\n\n" +
      "Thank you for supporting the Co-op and for taking advantage of our {promoName} offer. We were happy to welcome {referredMemberName}.",
  },
  prospectiveInfo: {
    name: "Prospective Information",
    description: "Info email for prospects requesting details",
    subject: "Thank You for Your Interest in Citizen's Oil Co-op",
    variables: ["websitePricingUrl", "websiteJoinUrl", "officePhone"],
    html:
      "<p>Thank you for your interest in the Citizen's Oil Co-op.</p>" +
      "<p>The Co-op has helped consumers save on energy needs for 30 years. " +
      "We work with full-service companies across Connecticut and Rhode Island and provide lower pricing for members.</p>" +
      "<p>You can review pricing here: <a href=\"{websitePricingUrl}\">{websitePricingUrl}</a></p>" +
      "<p>To join, call us at {officePhone} or sign up here: <a href=\"{websiteJoinUrl}\">{websiteJoinUrl}</a></p>" +
      "<p>Please let us know if we can answer any additional questions.</p>",
    text:
      "Thank you for your interest in the Citizen's Oil Co-op.\n\n" +
      "The Co-op has helped consumers save on energy for 30 years and works with full-service companies across CT and RI.\n\n" +
      "Pricing: {websitePricingUrl}\n" +
      "Join: {websiteJoinUrl}\n" +
      "Office: {officePhone}\n\n" +
      "Please let us know if we can answer any additional questions.",
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
