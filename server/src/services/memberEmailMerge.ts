import { config } from "../config.js";
import { BillingEvent } from "../models/BillingEvent.js";
import { Member, type MemberDoc } from "../models/Member.js";
import { OilCompany, type OilCompanyDoc } from "../models/OilCompany.js";
import { PaymentToken } from "../models/PaymentToken.js";
import { Referral } from "../models/Referral.js";
import { ORG } from "./emailTemplates.js";
import type mongoose from "mongoose";

export type MemberEmailMergeData = Record<string, string | number | boolean>;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const PARTNERS = {
  audit: { partnerName: "New England Smart Energy (NESE)", partnerPhone: "203-292-8088" },
  insurance: { contactName: "Insurance Partner", contactEmail: "insurance@oilco-op.com" },
  solar: {
    contactName: "Solar Partner",
    contactEmail: "solar@oilco-op.com",
    contactPhone: "860-561-6011",
  },
} as const;

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function membershipSeasonFromBillingDate(d: Date): string {
  const y = d.getFullYear();
  return `${y}/${y + 1}`;
}

function parseOilCompanyNotes(notes?: string): { contactName: string; companyAddress: string } {
  const text = String(notes ?? "");
  const contactName = text.match(/Contact:\s*([^\n|]+)/i)?.[1]?.trim() || "";
  const companyAddress = text.match(/Address:\s*([^\n|]+)/i)?.[1]?.trim() || "";
  return { contactName, companyAddress };
}

function memberAddressLines(member: Pick<MemberDoc, "addressLine1" | "addressLine2" | "city" | "state" | "postalCode">) {
  const line1 = [member.addressLine1, member.addressLine2].filter(Boolean).join(", ");
  const cityStateZip = [member.city, member.state, member.postalCode].filter(Boolean).join(" ").trim();
  return { address: line1 || "—", cityStateZip: cityStateZip || "—" };
}

export function buildMemberEmailMergeData(input: {
  member: MemberDoc;
  oilCompany?: Pick<OilCompanyDoc, "name" | "contactEmail" | "contactPhone" | "notes"> | null;
  billing?: Array<{
    kind: string;
    status: string;
    amountCents: number;
    billingYear?: number | null;
    authnetTransactionId?: string;
    cardLast4?: string;
    description?: string;
    createdAt?: Date;
  }>;
  referredMembers?: Array<{ firstName?: string; lastName?: string }>;
  paymentUrl?: string;
  paymentExpiresAt?: Date | null;
  promoName?: string;
}): MemberEmailMergeData {
  const { member, oilCompany, billing = [], referredMembers = [] } = input;
  const { address, cityStateZip } = memberAddressLines(member);
  const oilNotes = parseOilCompanyNotes(oilCompany?.notes);

  const nextBill = member.nextAnnualBillingDate ? new Date(member.nextAnnualBillingDate) : null;
  const now = new Date();
  const daysUntil = nextBill
    ? Math.max(0, Math.ceil((nextBill.getTime() - now.getTime()) / MS_PER_DAY))
    : 0;
  const billingDate = nextBill ? formatLongDate(nextBill) : "June 1";
  const nextBillingDate = billingDate;
  const amountCents = config.annualFeeCents;
  const amount = formatMoney(amountCents);
  const isAutoRenew = member.paymentMethod === "card" && member.autoRenew;

  const succeededAnnual = billing.find((b) => b.kind === "annual" && b.status === "succeeded");
  const failedAnnual = billing.find((b) => b.kind === "annual" && b.status === "failed");
  const cardLast4 = member.authnetCardLast4 || succeededAnnual?.cardLast4 || failedAnnual?.cardLast4 || "";

  const referredNames = referredMembers
    .map((m) => `${m.firstName || ""} ${m.lastName || ""}`.trim())
    .filter(Boolean);
  const referredMemberName = referredNames[0] || "";
  const referredMemberNames =
    referredNames.length <= 1
      ? referredMemberName
      : referredNames.length === 2
        ? `${referredNames[0]} and ${referredNames[1]}`
        : `${referredNames.slice(0, -1).join(", ")}, and ${referredNames[referredNames.length - 1]}`;

  const expiresAt = input.paymentExpiresAt
    ? formatLongDate(input.paymentExpiresAt)
    : "";

  const siteBase = (process.env.SITE_URL || process.env.CLIENT_ORIGIN || "https://oilco-op.com").replace(
    /\/$/,
    ""
  );

  return {
    firstName: member.firstName || "",
    lastName: member.lastName || "",
    memberName: `${member.firstName || ""} ${member.lastName || ""}`.trim() || "Member",
    memberNumber: member.memberNumber || "—",
    address,
    cityStateZip,
    email: member.email || "—",
    phone: member.phone || "—",
    companyName: oilCompany?.name || "Assigned Oil Company",
    companyPhone: oilCompany?.contactPhone || "",
    companyAddress: oilNotes.companyAddress,
    contactName: oilNotes.contactName,
    contactEmail: oilCompany?.contactEmail || PARTNERS.insurance.contactEmail,
    contactPhone: oilCompany?.contactPhone || PARTNERS.solar.contactPhone,
    officePhone: ORG.phone,
    websiteJoinUrl: `${siteBase}/join/`,
    websitePricingUrl: "https://oilco-op.com/services/heating-prices/",
    partnerName: PARTNERS.audit.partnerName,
    partnerPhone: PARTNERS.audit.partnerPhone,
    referredMemberName,
    referredMemberNames,
    referralCount: member.successfulReferralCount ?? 0,
    membershipSeason: nextBill ? membershipSeasonFromBillingDate(nextBill) : membershipSeasonFromBillingDate(now),
    promoName: input.promoName || "",
    nextBillingDate,
    daysUntil,
    billingDate,
    amount,
    isAutoRenew,
    cardLast4,
    transactionId: succeededAnnual?.authnetTransactionId || "",
    billingYear: succeededAnnual?.billingYear ?? new Date().getFullYear(),
    reason: failedAnnual?.description?.replace(/^Authorize\.Net:\s*/i, "") || "",
    paymentUrl: input.paymentUrl || "",
    expiresAt,
  };
}

export async function loadMemberEmailMergeData(
  memberId: mongoose.Types.ObjectId
): Promise<MemberEmailMergeData> {
  const member = await Member.findById(memberId);
  if (!member || member.role !== "member") {
    throw new Error("Member not found");
  }

  const [oilCompany, billing, referrals, activeToken] = await Promise.all([
    member.oilCompanyId ? OilCompany.findById(member.oilCompanyId).lean() : Promise.resolve(null),
    BillingEvent.find({ memberId: member._id }).sort({ createdAt: -1 }).limit(50).lean(),
    Referral.find({ referrerMemberId: member._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("newMemberId", "firstName lastName")
      .lean(),
    PaymentToken.findOne({ memberId: member._id, usedAt: null, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const tokenRow = activeToken as { token?: string; expiresAt?: Date | string } | null;

  const referredMembers = referrals
    .map((r) => r.newMemberId as { firstName?: string; lastName?: string } | null)
    .filter((m): m is { firstName?: string; lastName?: string } => Boolean(m));

  const paymentUrl = tokenRow?.token
    ? `${(process.env.SITE_URL || process.env.CLIENT_ORIGIN || "https://oilco-op.com").replace(/\/$/, "")}/pay/${tokenRow.token}`
    : "";

  return buildMemberEmailMergeData({
    member,
    oilCompany: oilCompany as Pick<OilCompanyDoc, "name" | "contactEmail" | "contactPhone" | "notes"> | null,
    billing: billing as unknown as Array<{
      kind: string;
      status: string;
      amountCents: number;
      billingYear?: number | null;
      authnetTransactionId?: string;
      cardLast4?: string;
      description?: string;
      createdAt?: Date;
    }>,
    referredMembers,
    paymentUrl,
    paymentExpiresAt: tokenRow?.expiresAt ? new Date(tokenRow.expiresAt) : null,
  });
}
