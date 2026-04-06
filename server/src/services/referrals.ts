import { Referral } from "../models/Referral.js";
import { Member } from "../models/Member.js";
import type mongoose from "mongoose";

const LIFETIME_REFERRALS = 5;

export async function applyReferralCredit(
  newMemberId: mongoose.Types.ObjectId,
  referrerMemberId: mongoose.Types.ObjectId
): Promise<void> {
  const existing = await Referral.findOne({ newMemberId });
  if (existing) return;

  const referrer = await Member.findById(referrerMemberId);
  if (!referrer || referrer.role !== "member") return;

  await Referral.create({ newMemberId, referrerMemberId });

  referrer.successfulReferralCount = (referrer.successfulReferralCount || 0) + 1;
  if (referrer.successfulReferralCount >= LIFETIME_REFERRALS) {
    referrer.lifetimeAnnualFeeWaived = true;
    referrer.referralWaiveCredits = 0;
  } else {
    referrer.referralWaiveCredits = (referrer.referralWaiveCredits || 0) + 1;
  }
  await referrer.save();
}

export async function findReferrerByToken(token: string) {
  const q = token.trim();
  if (!q) return null;
  if (/^[a-f\d]{24}$/i.test(q)) {
    const byId = await Member.findById(q);
    if (byId && byId.role === "member") return byId;
  }
  const lower = q.toLowerCase();
  const byEmail = await Member.findOne({ email: lower, role: "member" });
  if (byEmail) return byEmail;
  const parts = q.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const byName = await Member.findOne({
      role: "member",
      firstName: new RegExp(`^${escapeRe(parts[0])}$`, "i"),
      lastName: new RegExp(`^${escapeRe(parts[parts.length - 1])}$`, "i"),
    });
    if (byName) return byName;
  }
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 7) {
    const byPhone = await Member.findOne({ role: "member", phone: q });
    if (byPhone) return byPhone;
  }
  return null;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
