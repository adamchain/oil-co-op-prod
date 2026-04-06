import nodemailer from "nodemailer";
import { config } from "../config.js";
import { CommunicationLog } from "../models/CommunicationLog.js";
import type { MemberDoc } from "../models/Member.js";
import type mongoose from "mongoose";

let transporter: nodemailer.Transporter | null = null;

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
  const name = `${member.firstName} ${member.lastName}`.trim();
  await sendMemberEmail(
    member._id,
    member.email,
    "Welcome to the heating oil co-op",
    `Hi ${name},\n\nThank you for joining. Your registration payment was received.\n\n` +
      `Annual membership renews on June 1. You will receive reminders at 30, 7, and 1 day before your billing date.\n\n` +
      `Our team will assign your oil company shortly; you will be notified when that is complete.\n`
  );
}
