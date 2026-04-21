import nodemailer from "nodemailer";
import { config } from "../config.js";
import { CommunicationLog } from "../models/CommunicationLog.js";
import type { MemberDoc } from "../models/Member.js";
import type mongoose from "mongoose";
import {
  welcomeEmailHtml,
  renewalReminderHtml,
  paymentSuccessHtml,
  paymentFailedHtml,
  paymentLinkHtml,
  oilCompanyAssignedHtml,
} from "./emailTemplates.js";
import { EmailTemplate, type EmailTemplateKey } from "../models/EmailTemplate.js";
import { applyTemplateVariables } from "./emailTemplateStore.js";

let transporter: nodemailer.Transporter | null = null;

async function resolveTemplate(
  key: EmailTemplateKey,
  fallback: { subject: string; text: string; html: string },
  variables: Record<string, unknown>
) {
  const dbTemplate = (await EmailTemplate.findOne({ key })
    .select("subject html text")
    .lean()) as { subject?: string; html?: string; text?: string } | null;
  if (!dbTemplate || !dbTemplate.subject || !dbTemplate.html) {
    return fallback;
  }
  return {
    subject: applyTemplateVariables(dbTemplate.subject, variables),
    text: dbTemplate.text ? applyTemplateVariables(dbTemplate.text, variables) : fallback.text,
    html: applyTemplateVariables(dbTemplate.html, variables),
  };
}

function getTransporter() {
  if (!config.smtp.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth:
        config.smtp.user && config.smtp.pass
          ? { user: config.smtp.user, pass: config.smtp.pass }
          : undefined,
    });
  }
  return transporter;
}

export async function sendMemberEmail(
  memberId: mongoose.Types.ObjectId,
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<void> {
  const t = getTransporter();
  if (!t || !to) {
    console.info(`[email skipped or dev] To: ${to}\nSubject: ${subject}\n${text}`);
    await CommunicationLog.create({
      memberId,
      channel: "email",
      subject,
      bodyPreview: text.slice(0, 500),
      status: to ? "queued" : "skipped_no_contact",
      meta: { devLog: true },
    });
    return;
  }
  try {
    await t.sendMail({
      from: config.emailFrom,
      to,
      subject,
      text,
      html: html || `<pre>${escapeHtml(text)}</pre>`,
    });
    await CommunicationLog.create({
      memberId,
      channel: "email",
      subject,
      bodyPreview: text.slice(0, 500),
      status: "sent",
    });
  } catch (e) {
    console.error(e);
    await CommunicationLog.create({
      memberId,
      channel: "email",
      subject,
      bodyPreview: text.slice(0, 500),
      status: "failed",
      meta: { error: String(e) },
    });
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendWelcomeEmail(member: MemberDoc) {
  if (!member.notificationSettings?.emailEnabled) return;
  const nextBilling = member.nextAnnualBillingDate
    ? new Date(member.nextAnnualBillingDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "June 1";

  const text =
    `Hi ${member.firstName},\n\nThank you for joining Citizen's Oil Co-op!\n\n` +
    `Your member number is: ${member.memberNumber || "pending"}\n` +
    `Your next annual billing date is: ${nextBilling}\n\n` +
    `Our team will assign your oil company shortly; you will be notified when that is complete.\n`;

  const html = welcomeEmailHtml(
    member.firstName,
    member.memberNumber || "pending",
    nextBilling
  );

  const resolved = await resolveTemplate(
    "welcome",
    {
      subject: "Welcome to Citizen's Oil Co-op",
      text,
      html,
    },
    {
      firstName: member.firstName,
      memberNumber: member.memberNumber || "pending",
      nextBillingDate: nextBilling,
    }
  );

  await sendMemberEmail(member._id, member.email, resolved.subject, resolved.text, resolved.html);
}

export async function sendRenewalReminderEmail(
  member: MemberDoc,
  daysUntil: number,
  amount: number
) {
  if (!member.notificationSettings?.emailEnabled) return;
  if (!member.notificationSettings?.renewalReminders) return;

  const billingDate = member.nextAnnualBillingDate
    ? new Date(member.nextAnnualBillingDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "June 1";

  const amountStr = `$${(amount / 100).toFixed(2)}`;
  const isAutoRenew = member.paymentMethod === "card" && member.autoRenew;
  const cardLast4 = member.authnetCardLast4 || undefined;

  const text =
    `Hi ${member.firstName},\n\n` +
    `Your annual Oil Co-op membership fee of ${amountStr} will be billed in ${daysUntil} days on ${billingDate}.\n\n` +
    (isAutoRenew
      ? `Your card on file will be charged automatically.\n`
      : `Please mail a check or call the office to pay by card.\n`);

  const html = renewalReminderHtml(
    member.firstName,
    daysUntil,
    billingDate,
    amountStr,
    isAutoRenew,
    cardLast4
  );

  const resolved = await resolveTemplate(
    "renewalReminder",
    {
      subject: `Annual membership renewal - ${daysUntil === 1 ? "Tomorrow" : `${daysUntil} days`}`,
      text,
      html,
    },
    {
      firstName: member.firstName,
      daysUntil,
      billingDate,
      amount: amountStr,
      isAutoRenew,
      cardLast4: cardLast4 || "",
    }
  );

  await sendMemberEmail(member._id, member.email, resolved.subject, resolved.text, resolved.html);
}

export async function sendPaymentSuccessEmail(
  member: MemberDoc,
  amount: number,
  transactionId: string,
  cardLast4: string,
  billingYear: number
) {
  if (!member.notificationSettings?.emailEnabled) return;
  if (!member.notificationSettings?.billingNotices) return;

  const amountStr = `$${(amount / 100).toFixed(2)}`;

  const text =
    `Hi ${member.firstName},\n\n` +
    `Your annual membership payment of ${amountStr} has been processed successfully.\n\n` +
    `Card: ****${cardLast4}\n` +
    `Transaction ID: ${transactionId}\n` +
    `Billing Year: ${billingYear}\n\n` +
    `Thank you for your continued membership!\n`;

  const html = paymentSuccessHtml(
    member.firstName,
    amountStr,
    transactionId,
    cardLast4,
    billingYear
  );

  const resolved = await resolveTemplate(
    "paymentSuccess",
    {
      subject: "Payment received - Oil Co-op membership",
      text,
      html,
    },
    {
      firstName: member.firstName,
      amount: amountStr,
      transactionId,
      cardLast4,
      billingYear,
    }
  );

  await sendMemberEmail(member._id, member.email, resolved.subject, resolved.text, resolved.html);
}

export async function sendPaymentFailedEmail(
  member: MemberDoc,
  amount: number,
  reason?: string
) {
  if (!member.notificationSettings?.emailEnabled) return;
  if (!member.notificationSettings?.billingNotices) return;

  const amountStr = `$${(amount / 100).toFixed(2)}`;

  const text =
    `Hi ${member.firstName},\n\n` +
    `We were unable to process your annual membership payment of ${amountStr}.\n\n` +
    (reason ? `Reason: ${reason}\n\n` : "") +
    `Please call our office to update your payment method or arrange an alternative payment.\n`;

  const html = paymentFailedHtml(member.firstName, amountStr, reason);

  const resolved = await resolveTemplate(
    "paymentFailed",
    {
      subject: "Payment failed - Action required",
      text,
      html,
    },
    {
      firstName: member.firstName,
      amount: amountStr,
      reason: reason || "",
    }
  );

  await sendMemberEmail(member._id, member.email, resolved.subject, resolved.text, resolved.html);
}

export async function sendPaymentLinkEmail(
  member: MemberDoc,
  amount: number,
  paymentUrl: string,
  expiresAt: Date
) {
  if (!member.notificationSettings?.emailEnabled) return;

  const amountStr = `$${(amount / 100).toFixed(2)}`;
  const expiresStr = expiresAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const text =
    `Hi ${member.firstName},\n\n` +
    `Click the link below to pay your annual membership fee of ${amountStr}:\n\n` +
    `${paymentUrl}\n\n` +
    `This link expires on ${expiresStr}.\n`;

  const html = paymentLinkHtml(member.firstName, amountStr, paymentUrl, expiresStr);

  const resolved = await resolveTemplate(
    "paymentLink",
    {
      subject: `Pay your Oil Co-op membership - ${amountStr}`,
      text,
      html,
    },
    {
      firstName: member.firstName,
      amount: amountStr,
      paymentUrl,
      expiresAt: expiresStr,
    }
  );

  await sendMemberEmail(member._id, member.email, resolved.subject, resolved.text, resolved.html);
}

export async function sendOilCompanyAssignedEmail(
  member: MemberDoc,
  companyName: string,
  companyPhone?: string
) {
  if (!member.notificationSettings?.emailEnabled) return;
  if (!member.notificationSettings?.oilCompanyUpdates) return;

  const text =
    `Hi ${member.firstName},\n\n` +
    `Your Oil Co-op membership has been linked to: ${companyName}\n\n` +
    (companyPhone ? `Phone: ${companyPhone}\n\n` : "") +
    `You can now enjoy co-op member pricing on your heating oil deliveries.\n`;

  const html = oilCompanyAssignedHtml(member.firstName, companyName, companyPhone);

  const resolved = await resolveTemplate(
    "oilCompanyAssigned",
    {
      subject: "Your oil company has been assigned",
      text,
      html,
    },
    {
      firstName: member.firstName,
      companyName,
      companyPhone: companyPhone || "",
    }
  );

  await sendMemberEmail(member._id, member.email, resolved.subject, resolved.text, resolved.html);
}
