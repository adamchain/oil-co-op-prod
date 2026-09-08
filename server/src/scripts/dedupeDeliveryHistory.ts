/**
 * Scan every member and collapse duplicate delivery rows (same date + fuel +
 * gallons). Dry run by default; pass --apply to write.
 *
 *   cd server && MONGODB_URI='...' npx tsx src/scripts/dedupeDeliveryHistory.ts [--apply]
 */
import mongoose from "mongoose";
import { connectDb } from "../db.js";
import { config } from "../config.js";
import { Member } from "../models/Member.js";
import { mergeDeliveryRows, normalizeRows } from "../utils/deliveryRows.js";

async function main() {
  const apply = process.argv.includes("--apply");
  if (!config.mongoUri) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }
  await connectDb();

  const members = await Member.find({ role: "member" })
    .select("_id memberNumber firstName lastName legacyProfile.deliveryHistoryRows")
    .lean();

  let touched = 0;
  let removed = 0;
  const examples: string[] = [];

  for (const m of members) {
    const lp = (m.legacyProfile || {}) as Record<string, unknown>;
    const existing = normalizeRows(lp.deliveryHistoryRows);
    if (existing.length < 2) continue;
    const merged = mergeDeliveryRows(existing, []);
    const dropped = existing.length - merged.length;
    if (dropped <= 0) continue;
    touched++;
    removed += dropped;
    if (examples.length < 15) {
      examples.push(
        `${m.memberNumber || m._id} ${m.firstName} ${m.lastName}: ${existing.length} → ${merged.length}`
      );
    }
    if (apply) {
      await Member.updateOne(
        { _id: m._id },
        { $set: { "legacyProfile.deliveryHistoryRows": merged } }
      );
    }
  }

  console.log(`Members with duplicate deliveries: ${touched}`);
  console.log(`Duplicate rows ${apply ? "removed" : "would remove"}: ${removed}`);
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
