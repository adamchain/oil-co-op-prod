import crypto from "crypto";
import mongoose from "mongoose";
import { config } from "../config.js";
import { Member } from "../models/Member.js";
import { PaymentToken } from "../models/PaymentToken.js";
import { EmailTemplate } from "../models/EmailTemplate.js";
import { annualFeeCentsFor } from "../utils/membershipFees.js";
import { renewalCycle } from "./renewalLanes.js";
import { isBlankContactEmail } from "../utils/memberListFilters.js";
import { sendMemberEmail } from "./mail.js";
import { applyTemplateVariables, getTemplateDefinitions } from "./emailTemplateStore.js";
import { loadMemberEmailMergeData } from "./memberEmailMerge.js";

export type RenewalEmailLane = "processed" | "failed" | "manual" | "notPaid";

const LANE_TEMPLATE = {
  processed: "paymentSuccess",
  failed: "paymentFailed",
  manual: "manualRenewal",
  notPaid: "manualRenewal",
} as const;

function siteOrigin(): string {
  return (process.env.SITE_URL || config.clientOrigin || "https://oilco-op.com").replace(/\/$/, "");
}

/** One-time pay link for the membership year they are next due. Reuses an open link when one exists. */
async function ensureAnnualPaymentUrl(
  member: {
    _id: mongoose.Types.ObjectId;
    membershipPlan?: string | null;
    legacyProfile?: unknown;
  },
  billingYear: number
): Promise<string> {
  const existing = await PaymentToken.findOne({
    memberId: member._id,
    kind: "annual",
    billingYear,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
  if (existing) return `${siteOrigin()}/pay/${existing.token}`;

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 60);
  await PaymentToken.create({
    token,
    memberId: member._id,
    amountCents: annualFeeCentsFor(member),
    kind: "annual",
    billingYear,
    expiresAt,
  });
  return `${siteOrigin()}/pay/${token}`;
}

/**
 * Staff send of one renewal list. Payment-success and payment-failed are also
 * sent automatically when the renewal run charges or declines a card; this is
 * the button that emails a whole lane, including the manual and not-paid lists.
 */
export async function sendRenewalLaneEmails(input: {
  lane: RenewalEmailLane;
  memberIds: string[];
}): Promise<{ sent: number; skipped: number }> {
  const key = LANE_TEMPLATE[input.lane];
  const def = getTemplateDefinitions()[key];
  const stored = (await EmailTemplate.findOne({ key }).lean()) as {
    subject?: string;
    html?: string;
    text?: string;
  } | null;
  const subjectTpl = stored?.subject || def.subject;
  const htmlTpl = stored?.html || def.html;
  const textTpl = stored?.text || def.text;

  const ids = input.memberIds.filter((id) => mongoose.isValidObjectId(id));
  const members = await Member.find({ _id: { $in: ids }, role: "member" });

  let sent = 0;
  let skipped = 0;
  for (const member of members) {
    const optedOut = Boolean((member.legacyProfile as { emailOptOut?: boolean } | null)?.emailOptOut);
    const to = String(member.email || "").trim();
    if (isBlankContactEmail(to) || optedOut) {
      skipped++;
      continue;
    }
    if (input.lane === "manual" || input.lane === "notPaid") {
      const cycle = renewalCycle();
      const dueYear = member.nextAnnualBillingDate
        ? new Date(member.nextAnnualBillingDate).getUTCFullYear()
        : cycle.nextRenewalYear;
      // Not-paid links cover the year they already owe. Manual-lane links cover the upcoming renewal.
      const billingYear = input.lane === "notPaid" ? cycle.currentBillingYear : dueYear;
      await ensureAnnualPaymentUrl(member, billingYear);
    }
    const data = await loadMemberEmailMergeData(member._id);
    await sendMemberEmail(
      member._id,
      to,
      applyTemplateVariables(subjectTpl, data),
      applyTemplateVariables(textTpl, data),
      applyTemplateVariables(htmlTpl, data)
    );
    sent++;
  }
  skipped += ids.length - members.length;
  return { sent, skipped };
}
