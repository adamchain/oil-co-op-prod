import { Referral } from "../models/Referral.js";
import { Member } from "../models/Member.js";
import type mongoose from "mongoose";

const LIFETIME_REFERRALS = 5;
/** Minimum name similarity (0-1) for a fuzzy referrer match to count. */
const FUZZY_THRESHOLD = 0.72;

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

/** Undo the credit for a member's current referral and delete the link. */
export async function removeReferralCredit(
  newMemberId: mongoose.Types.ObjectId
): Promise<void> {
  const existing = await Referral.findOne({ newMemberId });
  if (!existing) return;
  await Referral.deleteOne({ _id: existing._id });

  const referrer = await Member.findById(existing.referrerMemberId);
  if (referrer && referrer.role === "member") {
    referrer.successfulReferralCount = Math.max(0, (referrer.successfulReferralCount || 0) - 1);
    // Best-effort reversal: waive credits are consumed over time, so we can only
    // subtract the one this referral originally added, clamped at zero.
    referrer.referralWaiveCredits = Math.max(0, (referrer.referralWaiveCredits || 0) - 1);
    referrer.lifetimeAnnualFeeWaived = referrer.successfulReferralCount >= LIFETIME_REFERRALS;
    await referrer.save();
  }
}

/**
 * Admin correction: set (or clear) who referred `newMemberId`, keeping the
 * Referral link, the member's `referredByMemberId`, and both members' credit
 * counters consistent. Pass `referrerMemberId = null` to clear the referrer.
 */
export async function setMemberReferrer(
  newMemberId: mongoose.Types.ObjectId,
  referrerMemberId: mongoose.Types.ObjectId | null
): Promise<void> {
  const member = await Member.findById(newMemberId);
  if (!member || member.role !== "member") throw new Error("Member not found");

  const existing = await Referral.findOne({ newMemberId });
  const currentId = existing ? String(existing.referrerMemberId) : null;
  const targetId = referrerMemberId ? String(referrerMemberId) : null;
  if (currentId === targetId) return; // no change

  if (targetId && targetId === String(newMemberId)) {
    throw new Error("A member cannot refer themselves");
  }

  // Remove the old link + credit first so applyReferralCredit can re-create it.
  if (existing) await removeReferralCredit(newMemberId);

  member.referredByMemberId = null;
  await member.save();

  if (targetId) {
    const referrer = await Member.findById(targetId);
    if (!referrer || referrer.role !== "member") throw new Error("Referrer must be a member");
    member.referredByMemberId = referrer._id;
    await member.save();
    await applyReferralCredit(member._id, referrer._id);
  }
}

/**
 * Resolve a free-text referrer token (name, email, member #, or phone) to a
 * member. Tries exact matches first, then falls back to fuzzy name matching so
 * typos and partial names still find the closest existing member.
 */
export async function findReferrerByToken(token: string) {
  const q = token.trim();
  if (!q) return null;

  // 1. Exact Mongo ObjectId
  if (/^[a-f\d]{24}$/i.test(q)) {
    const byId = await Member.findById(q);
    if (byId && byId.role === "member") return byId;
  }

  const lower = q.toLowerCase();

  // 2. Exact email
  if (lower.includes("@")) {
    const byEmail = await Member.findOne({ email: lower, role: "member" });
    if (byEmail) return byEmail;
  }

  // 3. Member number (e.g. OC-2026-0001)
  if (/[a-z]/i.test(q) && /\d/.test(q)) {
    const byNumber = await Member.findOne({
      role: "member",
      memberNumber: new RegExp(`^${escapeRe(q)}$`, "i"),
    });
    if (byNumber) return byNumber;
  }

  // 4. Exact phone
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 7 && !/[a-z]/i.test(q)) {
    const byPhone = await Member.findOne({ role: "member", phone: q });
    if (byPhone) return byPhone;
  }

  // 5. Fuzzy name match — only for alphabetic, non-email tokens, so a mistyped
  // email or phone number can't accidentally fuzzy-match someone's name.
  if (lower.includes("@") || !/[a-z]/i.test(q)) return null;
  const parts = q.split(/[\s,]+/).filter(Boolean);
  const or: Record<string, unknown>[] = [];
  for (const p of parts) {
    if (p.length < 2) continue;
    const prefix = escapeRe(p.slice(0, Math.min(3, p.length)));
    const contains = escapeRe(p);
    or.push({ firstName: new RegExp(`^${prefix}`, "i") });
    or.push({ lastName: new RegExp(`^${prefix}`, "i") });
    or.push({ firstName: new RegExp(contains, "i") });
    or.push({ lastName: new RegExp(contains, "i") });
  }
  if (or.length === 0) return null;

  const candidates = await Member.find({ role: "member", $or: or }).limit(300);
  let best: (typeof candidates)[number] | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const score = nameScore(q, c.firstName || "", c.lastName || "");
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore >= FUZZY_THRESHOLD ? best : null;
}

/** Best similarity of a query against a candidate's first/last name. */
function nameScore(query: string, first: string, last: string): number {
  const q = norm(query);
  const f = norm(first);
  const l = norm(last);
  const full = `${f} ${l}`.trim();
  const parts = q.split(" ").filter(Boolean);

  const scores = [sim(q, full), sim(q, `${l} ${f}`.trim())];

  if (parts.length >= 2) {
    // Compare first token→firstName and last token→lastName (and swapped).
    const a = (sim(parts[0], f) + sim(parts[parts.length - 1], l)) / 2;
    const b = (sim(parts[0], l) + sim(parts[parts.length - 1], f)) / 2;
    scores.push(a, b);
  } else if (parts.length === 1) {
    // Single token: match either name, but require a strong hit.
    scores.push(sim(parts[0], f), sim(parts[0], l));
  }
  return Math.max(...scores);
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Normalized Levenshtein similarity in [0, 1]. */
function sim(a: string, b: string): number {
  if (a === b) return 1;
  const max = Math.max(a.length, b.length);
  if (max === 0) return 0;
  return 1 - levenshtein(a, b) / max;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
