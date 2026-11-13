/**
 * Remove coop-transfer placeholder emails such as
 * ct-12345-name@import.oilcoop.local. The email field is unset (not set to "")
 * so the sparse unique index still allows members with no address.
 *
 * Dry run by default. Pass --apply to write.
 *
 *   cd server && npx tsx src/scripts/clearPlaceholderEmails.ts [--apply]
 */
import mongoose from "mongoose";
import { connectDb } from "../db.js";
import { config } from "../config.js";
import { Member } from "../models/Member.js";

const PLACEHOLDER = /^ct-[^@\s]+@import\.oilcoop\.local$/i;

async function main() {
  const apply = process.argv.includes("--apply");
  if (!config.mongoUri) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }
  const remote = !/127\.0\.0\.1|localhost/.test(config.mongoUri);
  console.log(`Mongo target: ${remote ? "REMOTE" : "LOCAL"}`);
  await connectDb();

  // The schema is unique + sparse. An older unique index treats a missing email
  // as null, so only one member can have a blank address.
  if (apply) {
    const indexes = await Member.collection.indexes();
    const emailIndex = indexes.find((idx) => idx.key?.email === 1 && Object.keys(idx.key).length === 1);
    if (emailIndex && !emailIndex.sparse) {
      console.log(`Rebuilding ${emailIndex.name} as a sparse unique index.`);
      await Member.collection.dropIndex(emailIndex.name);
      await Member.collection.createIndex({ email: 1 }, { unique: true, sparse: true, name: "email_1" });
    }
  }

  const members = await Member.find({
    $or: [
      { email: { $regex: PLACEHOLDER } },
      { "legacyProfile.email2": { $regex: PLACEHOLDER } },
    ],
  })
    .select("memberNumber firstName lastName email legacyProfile.email2")
    .lean();

  let emailHits = 0;
  let email2Hits = 0;
  const examples: string[] = [];
  for (const m of members) {
    const email = String(m.email || "");
    const email2 = String((m.legacyProfile as { email2?: string } | undefined)?.email2 || "");
    const clearEmail = PLACEHOLDER.test(email);
    const clearEmail2 = PLACEHOLDER.test(email2);
    if (clearEmail) emailHits++;
    if (clearEmail2) email2Hits++;
    if (examples.length < 12) {
      examples.push(
        `${m.memberNumber || m._id} ${m.firstName || ""} ${m.lastName || ""}`.trim() +
          (clearEmail ? `  ${email}` : "") +
          (clearEmail2 ? `  email2 ${email2}` : "")
      );
    }
  }

  if (apply && (emailHits || email2Hits)) {
    if (emailHits) {
      const result = await Member.collection.updateMany(
        { email: { $regex: PLACEHOLDER } },
        { $unset: { email: "" } }
      );
      console.log(`Email fields cleared: ${result.modifiedCount}`);
    }
    if (email2Hits) {
      const result = await Member.collection.updateMany(
        { "legacyProfile.email2": { $regex: PLACEHOLDER } },
        { $unset: { "legacyProfile.email2": "" } }
      );
      console.log(`Second-email fields cleared: ${result.modifiedCount}`);
    }
  }

  console.log(`Members matched: ${members.length}`);
  console.log(`Email fields ${apply ? "cleared" : "to clear"}: ${emailHits}`);
  console.log(`Second-email fields ${apply ? "cleared" : "to clear"}: ${email2Hits}`);
  if (examples.length) {
    console.log("Examples:");
    for (const line of examples) console.log(`  ${line}`);
  }
  if (!apply) console.log("\nDRY RUN — re-run with --apply to write.");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
