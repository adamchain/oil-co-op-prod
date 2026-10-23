import "dotenv/config";
import mongoose from "mongoose";
import { connectDb } from "../db.js";
import { Member } from "../models/Member.js";
import { BillingEvent } from "../models/BillingEvent.js";
import { ActivityLog } from "../models/ActivityLog.js";
import { CommunicationLog } from "../models/CommunicationLog.js";
import { PaymentToken } from "../models/PaymentToken.js";
import { LoginCode } from "../models/LoginCode.js";
import { Referral } from "../models/Referral.js";

/**
 * Delete the demo/seed members created by seed.ts and their related records.
 *
 * Seed members are the only records that have BOTH an "OC-SEED-####" member number
 * and an "@seed.oilcoop.local" email, so both are required here as a safety belt —
 * real imported members never carry either. Dry run by default; pass --confirm to
 * actually delete.
 *
 *   npm run unseed                 # count only, deletes nothing
 *   npm run unseed -- --confirm    # delete
 *
 * Run against production with: railway run --service <server> npm run unseed -- --confirm
 */

const SEED_FILTER = {
  role: "member",
  memberNumber: { $regex: /^OC-SEED-\d{4}$/ },
  email: { $regex: /@seed\.oilcoop\.local$/i },
} as const;

async function main() {
  const confirm = process.argv.includes("--confirm");
  await connectDb();

  const dbName = mongoose.connection.name;
  const host = mongoose.connection.host;
  console.log(`Connected to ${host} / ${dbName}`);

  const seed = await Member.find(SEED_FILTER).select("_id memberNumber email").lean();
  const seedIds = seed.map((m) => m._id);
  console.log(`Matched ${seedIds.length} seed members (OC-SEED-* + @seed.oilcoop.local).`);
  if (seed.length) {
    const sample = seed.slice(0, 3).map((m) => `${m.memberNumber} <${m.email}>`);
    console.log(`  e.g. ${sample.join(", ")}${seed.length > 3 ? " …" : ""}`);
  }

  // Guard: make sure this filter is not about to hit real members.
  const totalMembers = await Member.countDocuments({ role: "member" });
  const looseSeed = await Member.countDocuments({ memberNumber: { $regex: /^OC-SEED-/ } });
  console.log(`  (${totalMembers} total members; ${looseSeed} with an OC-SEED- number)`);
  if (looseSeed !== seedIds.length) {
    console.warn(
      `  WARNING: ${looseSeed} records start with OC-SEED- but only ${seedIds.length} also have the seed email. Not deleting the mismatch.`
    );
  }

  if (!seedIds.length) {
    console.log("Nothing to delete.");
    await mongoose.disconnect();
    return;
  }

  if (!confirm) {
    console.log("\nDRY RUN — no changes made. Re-run with --confirm to delete these members and their related records.");
    await mongoose.disconnect();
    return;
  }

  const [billing, activity, comms, tokens, codes, referrals, unlinked, members] = await Promise.all([
    BillingEvent.deleteMany({ memberId: { $in: seedIds } }),
    ActivityLog.deleteMany({ $or: [{ memberId: { $in: seedIds } }, { actorId: { $in: seedIds } }] }),
    CommunicationLog.deleteMany({ memberId: { $in: seedIds } }),
    PaymentToken.deleteMany({ memberId: { $in: seedIds } }),
    LoginCode.deleteMany({ memberId: { $in: seedIds } }),
    Referral.deleteMany({ $or: [{ newMemberId: { $in: seedIds } }, { referrerMemberId: { $in: seedIds } }] }),
    Member.updateMany(
      { "properties.linkedMemberId": { $in: seedIds } },
      { $pull: { properties: { linkedMemberId: { $in: seedIds } } } }
    ),
    Member.deleteMany({ _id: { $in: seedIds } }),
  ]);

  console.log("\nDeleted:");
  console.log(`  members:          ${members.deletedCount}`);
  console.log(`  billing events:   ${billing.deletedCount}`);
  console.log(`  activity logs:    ${activity.deletedCount}`);
  console.log(`  comm logs:        ${comms.deletedCount}`);
  console.log(`  payment tokens:   ${tokens.deletedCount}`);
  console.log(`  login codes:      ${codes.deletedCount}`);
  console.log(`  referrals:        ${referrals.deletedCount}`);
  console.log(`  property links cleared on: ${unlinked.modifiedCount} members`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
