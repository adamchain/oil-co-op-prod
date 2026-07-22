/**
 * Backfill Referral documents from the legacy `legacyProfile.referredById` field.
 *
 * Why: imported members carry their referrer as `legacyProfile.referredById`
 * (the referrer's member number, e.g. "15857"), but the import never created a
 * `Referral` document. The admin dashboard's "Members they referred" count/list
 * read ONLY the Referral collection, so those referrals are invisible (e.g. Nigel
 * shows 1 referral instead of the dozens actually attributed to him).
 *
 * This script resolves each `referredById` to a referrer member and creates the
 * missing Referral doc, sets `referredByMemberId`, and recomputes each referrer's
 * `successfulReferralCount` + lifetime-waiver flag — matching what the admin UI
 * does for a manual referral.
 *
 * SAFE BY DEFAULT: runs as a DRY RUN and only reports. Pass --commit to write.
 *
 * Usage:
 *   cd server && MONGODB_URI='mongodb+srv://...' npx tsx src/scripts/backfillReferrals.ts
 *   cd server && MONGODB_URI='mongodb+srv://...' npx tsx src/scripts/backfillReferrals.ts --commit
 */
import mongoose from "mongoose";
import { connectDb } from "../db.js";
import { Member } from "../models/Member.js";
import { Referral } from "../models/Referral.js";

const LIFETIME_REFERRALS = 5;
const COMMIT = process.argv.includes("--commit");

function lp(m: { legacyProfile?: unknown }, key: string): string {
  const profile = (m.legacyProfile as Record<string, unknown> | undefined) || undefined;
  const v = profile?.[key];
  return v == null ? "" : String(v).trim();
}

function parseDate(s: string): Date | undefined {
  if (!s) return undefined;
  const t = Date.parse(s);
  return Number.isNaN(t) ? undefined : new Date(t);
}

async function main() {
  await connectDb();
  console.log(`\nBackfill referrals — ${COMMIT ? "COMMIT (writing)" : "DRY RUN (no writes)"}\n`);

  type LeanMember = {
    _id: mongoose.Types.ObjectId;
    firstName?: string;
    lastName?: string;
    memberNumber?: string;
    legacyProfile?: Record<string, unknown>;
  };
  const members = (await Member.find({ role: "member" })
    .select("_id firstName lastName memberNumber legacyProfile")
    .lean()) as unknown as LeanMember[];

  // Resolve a referrer id-string to a member _id. The stored value is a member
  // number, but fall back to the legacy id too, since either can hold the "15857".
  const byMemberNumber = new Map<string, string>();
  const byLegacyId = new Map<string, string>();
  for (const m of members) {
    const mn = (m.memberNumber || "").trim();
    if (mn) byMemberNumber.set(mn, String(m._id));
    const lid = lp(m, "legacyId");
    if (lid) byLegacyId.set(lid, String(m._id));
  }
  const resolveReferrer = (ref: string): string | undefined =>
    byMemberNumber.get(ref) || byLegacyId.get(ref);

  // Members that already have a referral link (unique on newMemberId).
  const existing = await Referral.find({}).select("newMemberId").lean();
  const alreadyLinked = new Set(existing.map((r) => String(r.newMemberId)));

  const toCreate: { newMemberId: string; referrerMemberId: string; creditedAt?: Date }[] = [];
  let skippedAlready = 0;
  let selfReferral = 0;
  const unresolved = new Map<string, number>();

  for (const m of members) {
    const ref = lp(m, "referredById");
    if (!ref) continue;
    if (alreadyLinked.has(String(m._id))) {
      skippedAlready++;
      continue;
    }
    const referrerId = resolveReferrer(ref);
    if (!referrerId) {
      unresolved.set(ref, (unresolved.get(ref) || 0) + 1);
      continue;
    }
    if (referrerId === String(m._id)) {
      selfReferral++;
      continue;
    }
    toCreate.push({
      newMemberId: String(m._id),
      referrerMemberId: referrerId,
      creditedAt: parseDate(lp(m, "dateReferred")),
    });
  }

  // Report: how many new referrals per referrer (top of the list).
  const perReferrer = new Map<string, number>();
  for (const c of toCreate) perReferrer.set(c.referrerMemberId, (perReferrer.get(c.referrerMemberId) || 0) + 1);
  const nameById = new Map(members.map((m) => [String(m._id), `${m.firstName || ""} ${m.lastName || ""}`.trim() || String(m._id)]));

  console.log(`Members with legacyProfile.referredById set : ${members.filter((m) => lp(m, "referredById")).length}`);
  console.log(`Already linked (has Referral, skipped)      : ${skippedAlready}`);
  console.log(`Self-referrals (skipped)                    : ${selfReferral}`);
  console.log(`Unresolved referrer id (no match, skipped)  : ${[...unresolved.values()].reduce((a, b) => a + b, 0)}`);
  console.log(`Referral docs to create                     : ${toCreate.length}\n`);

  const topReferrers = [...perReferrer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  if (topReferrers.length) {
    console.log("Top referrers gaining referrals:");
    for (const [id, n] of topReferrers) console.log(`  ${nameById.get(id)} — +${n}`);
    console.log("");
  }
  if (unresolved.size) {
    const topUnresolved = [...unresolved.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
    console.log("Unresolved referredById values (no member matched):");
    for (const [ref, n] of topUnresolved) console.log(`  "${ref}" — ${n} member(s)`);
    console.log("");
  }

  if (!COMMIT) {
    console.log("DRY RUN complete — no changes written. Re-run with --commit to apply.\n");
    await mongoose.disconnect();
    return;
  }

  // Create referral docs (idempotent: unique index on newMemberId guards dupes).
  let created = 0;
  for (const c of toCreate) {
    try {
      await Referral.create({
        newMemberId: new mongoose.Types.ObjectId(c.newMemberId),
        referrerMemberId: new mongoose.Types.ObjectId(c.referrerMemberId),
        ...(c.creditedAt ? { creditedAt: c.creditedAt } : {}),
      });
      await Member.updateOne(
        { _id: c.newMemberId },
        { $set: { referredByMemberId: new mongoose.Types.ObjectId(c.referrerMemberId) } }
      );
      created++;
    } catch (e) {
      console.warn(`  skip ${c.newMemberId}: ${e instanceof Error ? e.message : e}`);
    }
  }

  // Recompute successfulReferralCount + lifetime waiver for every affected referrer.
  for (const referrerId of perReferrer.keys()) {
    const count = await Referral.countDocuments({ referrerMemberId: referrerId });
    await Member.updateOne(
      { _id: referrerId },
      { $set: { successfulReferralCount: count, lifetimeAnnualFeeWaived: count >= LIFETIME_REFERRALS } }
    );
  }

  console.log(`\nCOMMIT complete — created ${created} referral docs, updated ${perReferrer.size} referrer counters.\n`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
