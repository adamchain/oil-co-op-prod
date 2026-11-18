/**
 * Remove oil-import stub members (OC-######) that duplicate an Approach record (CT-#####).
 *
 * Stubs were created from delivery spreadsheets before the Approach roster import.
 * The roster then inserted a second member as CT-{Approach ID} instead of updating
 * the stub. The workbench also displayed OC-001005 as "1005", which is a different
 * Approach member.
 *
 * A stub is removed only when exactly one CT member matches:
 *   - the same legacyProfile.legacyId and the same name, or
 *   - the same oil account and the same first name, with a last name off by at most
 *     one character (Perreault / Perrault).
 *
 * Deliveries on the stub are merged onto the Approach record. Phantom "awaiting
 * check" bills on the stub are deleted. Real payments are moved. Staff accounts
 * and second oil accounts (12313-2 vs 12313-1) that do not match are left alone.
 *
 * Dry run by default.
 *   cd server && npx tsx src/scripts/dedupeOcImportStubs.ts [--apply]
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { connectDb } from "../db.js";
import { config } from "../config.js";
import { Member } from "../models/Member.js";
import { BillingEvent } from "../models/BillingEvent.js";
import { ActivityLog } from "../models/ActivityLog.js";
import { CommunicationLog } from "../models/CommunicationLog.js";
import { Referral } from "../models/Referral.js";
import { PaymentToken } from "../models/PaymentToken.js";
import { LoginCode } from "../models/LoginCode.js";
import { accountKeys, mergeDeliveryRows, normalizeRows } from "../utils/deliveryRows.js";

type LeanMember = {
  _id: mongoose.Types.ObjectId;
  memberNumber?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  addressLine1?: string;
  legacyProfile?: Record<string, unknown>;
  notesHistory?: { text?: string }[];
  authnetCustomerProfileId?: string;
  authnetPaymentProfileId?: string;
  authnetCardLast4?: string;
  authnetCardExpiry?: string;
  primaryMemberId?: mongoose.Types.ObjectId | null;
};

function letters(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z]+/g, "");
}

function sameName(a: LeanMember, b: LeanMember): boolean {
  return letters(a.firstName) === letters(b.firstName) && letters(a.lastName) === letters(b.lastName);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = a[i - 1] === b[j - 1] ? prev : Math.min(prev, row[j - 1], row[j]) + 1;
      prev = row[j];
      row[j] = next;
    }
  }
  return row[b.length];
}

/** Same person with a one-letter last-name spelling difference. */
function closeName(a: LeanMember, b: LeanMember): boolean {
  if (sameName(a, b)) return true;
  if (letters(a.firstName) !== letters(b.firstName)) return false;
  return levenshtein(letters(a.lastName), letters(b.lastName)) <= 1;
}

function isPlaceholderEmail(email: string): boolean {
  const v = email.toLowerCase();
  return !v || v.endsWith(".local") || v.includes("@import.") || v.startsWith("delivery-setup-") || v.startsWith("import-imp_");
}

function noteKey(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

async function main() {
  const apply = process.argv.includes("--apply");
  if (!config.mongoUri) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }
  await connectDb();

  const stubs = (await Member.find({ role: "member", memberNumber: /^OC-\d+$/ }).lean()) as LeanMember[];
  const keepers = (await Member.find({ role: "member", memberNumber: /^CT-/ })
    .select("memberNumber firstName lastName email phone addressLine1 legacyProfile notesHistory authnetCustomerProfileId authnetPaymentProfileId authnetCardLast4 authnetCardExpiry primaryMemberId")
    .lean()) as LeanMember[];

  const byLegacy = new Map<string, LeanMember[]>();
  const byOil = new Map<string, LeanMember[]>();
  for (const keeper of keepers) {
    const legacyId = String(keeper.legacyProfile?.legacyId || "").trim();
    if (legacyId) {
      const list = byLegacy.get(legacyId) || [];
      list.push(keeper);
      byLegacy.set(legacyId, list);
    }
    for (const key of accountKeys(String(keeper.legacyProfile?.oilId || ""))) {
      const list = byOil.get(key) || [];
      list.push(keeper);
      byOil.set(key, list);
    }
  }

  const pairs: { stub: LeanMember; keeper: LeanMember; why: string }[] = [];
  const skipped: string[] = [];

  for (const stub of stubs) {
    const legacyId = String(stub.legacyProfile?.legacyId || "").trim();
    if (legacyId) {
      const hits = (byLegacy.get(legacyId) || []).filter((keeper) => sameName(stub, keeper));
      if (hits.length === 1) {
        pairs.push({ stub, keeper: hits[0], why: "legacyId" });
        continue;
      }
      if (hits.length > 1) {
        skipped.push(`${stub.memberNumber} legacy ${legacyId} matches ${hits.length} Approach records`);
        continue;
      }
    }

    const oilHits = new Map<string, LeanMember>();
    for (const key of accountKeys(String(stub.legacyProfile?.oilId || ""))) {
      for (const keeper of byOil.get(key) || []) oilHits.set(String(keeper._id), keeper);
    }
    const named = [...oilHits.values()].filter((keeper) => closeName(stub, keeper));
    if (named.length === 1) {
      pairs.push({ stub, keeper: named[0], why: sameName(stub, named[0]) ? "oilId" : "oilId-spelling" });
      continue;
    }
    if (named.length > 1) {
      skipped.push(`${stub.memberNumber} oil account matches ${named.length} Approach records`);
    }
  }

  console.log(`OC stubs: ${stubs.length}  duplicates to remove: ${pairs.length}  mode: ${apply ? "APPLY" : "DRY RUN"}`);
  const byWhy: Record<string, number> = {};
  let deliveriesAdded = 0;
  for (const { stub, keeper, why } of pairs) {
    byWhy[why] = (byWhy[why] || 0) + 1;
    const before = normalizeRows(keeper.legacyProfile?.deliveryHistoryRows).length;
    const merged = mergeDeliveryRows(
      normalizeRows(keeper.legacyProfile?.deliveryHistoryRows),
      normalizeRows(stub.legacyProfile?.deliveryHistoryRows)
    );
    deliveriesAdded += merged.length - before;
  }
  console.log("Match reasons:", byWhy);
  console.log(`Delivery rows that exist only on the stub: ${deliveriesAdded}`);
  console.log("Left in place (not a same-person Approach duplicate):");
  const pairedIds = new Set(pairs.map((p) => String(p.stub._id)));
  for (const stub of stubs) {
    if (pairedIds.has(String(stub._id))) continue;
    const lp = stub.legacyProfile || {};
    console.log(
      `  ${stub.memberNumber} ${stub.firstName} ${stub.lastName} oil=${lp.oilId || "—"} legacy=${lp.legacyId || "—"}`
    );
  }
  for (const line of skipped) console.log("  skip:", line);
  console.log("Sample removals:");
  for (const { stub, keeper, why } of pairs.slice(0, 12)) {
    console.log(`  ${stub.memberNumber} ${stub.firstName} ${stub.lastName} → ${keeper.memberNumber} (${why})`);
  }

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to delete these stubs.");
    await mongoose.disconnect();
    return;
  }

  const backupPath = path.join("/tmp", `oc-stub-dedupe-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(pairs.map((p) => p.stub), null, 2));
  console.log(`Backup of stubs written to ${backupPath}`);

  let removed = 0;
  for (const { stub, keeper } of pairs) {
    const stubId = stub._id;
    const keeperId = keeper._id;
    const mergedRows = mergeDeliveryRows(
      normalizeRows(keeper.legacyProfile?.deliveryHistoryRows),
      normalizeRows(stub.legacyProfile?.deliveryHistoryRows)
    );
    const keeperNotes = Array.isArray(keeper.notesHistory) ? keeper.notesHistory : [];
    const seenNotes = new Set(keeperNotes.map((n) => noteKey(n.text || "")));
    const stubNotes = (Array.isArray(stub.notesHistory) ? stub.notesHistory : []).filter((n) => {
      const key = noteKey(n.text || "");
      return key && !seenNotes.has(key);
    });

    const keeperEmail = String(keeper.email || "");
    const stubEmail = String(stub.email || "");
    const copyEmail = isPlaceholderEmail(keeperEmail) && !isPlaceholderEmail(stubEmail);

    const $set: Record<string, unknown> = {
      "legacyProfile.deliveryHistoryRows": mergedRows,
    };
    if (copyEmail) $set.email = stubEmail.toLowerCase();
    if (!keeper.phone && stub.phone) $set.phone = stub.phone;
    if (!String(keeper.legacyProfile?.oilId || "") && stub.legacyProfile?.oilId) {
      $set["legacyProfile.oilId"] = stub.legacyProfile.oilId;
    }
    if (!keeper.authnetCustomerProfileId && stub.authnetCustomerProfileId) {
      $set.authnetCustomerProfileId = stub.authnetCustomerProfileId;
      $set.authnetPaymentProfileId = stub.authnetPaymentProfileId || "";
      $set.authnetCardLast4 = stub.authnetCardLast4 || "";
      $set.authnetCardExpiry = stub.authnetCardExpiry || "";
    }

    if (copyEmail) await Member.updateOne({ _id: stubId }, { $unset: { email: "" } });
    await Member.updateOne(
      { _id: keeperId },
      {
        $set,
        ...(stubNotes.length ? { $push: { notesHistory: { $each: stubNotes } } } : {}),
      }
    );

    await BillingEvent.deleteMany({
      memberId: stubId,
      status: "pending",
      manualEntry: { $ne: true },
    });
    await BillingEvent.updateMany({ memberId: stubId }, { $set: { memberId: keeperId } });
    await ActivityLog.updateMany({ memberId: stubId }, { $set: { memberId: keeperId } });
    await CommunicationLog.updateMany({ memberId: stubId }, { $set: { memberId: keeperId } });
    await PaymentToken.updateMany({ memberId: stubId }, { $set: { memberId: keeperId } });
    await LoginCode.deleteMany({ memberId: stubId });

    const keeperReferral = await Referral.findOne({ newMemberId: keeperId }).select("_id").lean();
    if (keeperReferral) await Referral.deleteMany({ newMemberId: stubId });
    else await Referral.updateMany({ newMemberId: stubId }, { $set: { newMemberId: keeperId } });
    await Referral.updateMany({ referrerMemberId: stubId }, { $set: { referrerMemberId: keeperId } });

    await Member.updateMany({ primaryMemberId: stubId }, { $set: { primaryMemberId: keeperId } });
    await Member.updateMany({ referredByMemberId: stubId }, { $set: { referredByMemberId: keeperId } });
    await Member.updateMany(
      { "properties.linkedMemberId": stubId },
      { $set: { "properties.$[p].linkedMemberId": keeperId } },
      { arrayFilters: [{ "p.linkedMemberId": stubId }] }
    );

    await Member.deleteOne({ _id: stubId });
    removed++;
  }

  const bailey = await Member.find({
    lastName: /^bailey$/i,
    firstName: /^richard/i,
  }).select("memberNumber email legacyProfile.legacyId legacyProfile.newMemberDt").lean();
  console.log(`Removed ${removed} stub members.`);
  console.log("Richard Bailey records now:", bailey.map((m) => `${m.memberNumber} legacy=${(m.legacyProfile as { legacyId?: string })?.legacyId || ""}`).join("; ") || "(none)");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
