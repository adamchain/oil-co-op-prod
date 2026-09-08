/**
 * Drop duplicate internal notes (same text as another history row or as the
 * Approach NOTE field). Dry run by default; pass --apply to write.
 *
 *   cd server && MONGODB_URI='...' npx tsx src/scripts/dedupeNotesHistory.ts [--apply]
 */
import mongoose from "mongoose";
import { connectDb } from "../db.js";
import { config } from "../config.js";
import { Member } from "../models/Member.js";
import { normalizeNoteText } from "../utils/legacyImport.js";

async function main() {
  const apply = process.argv.includes("--apply");
  if (!config.mongoUri) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }
  await connectDb();

  const members = await Member.find({ role: "member" })
    .select("_id memberNumber firstName lastName notes notesHistory")
    .lean();

  let touched = 0;
  let removed = 0;
  const examples: string[] = [];

  for (const m of members) {
    const history = Array.isArray(m.notesHistory) ? m.notesHistory : [];
    if (history.length === 0) continue;
    const legacyKey = normalizeNoteText(m.notes || "");
    const seen = new Set<string>();
    const kept: typeof history = [];
    for (const note of history) {
      const key = normalizeNoteText(String((note as { text?: string }).text || ""));
      if (!key || (legacyKey && key === legacyKey) || seen.has(key)) continue;
      seen.add(key);
      kept.push(note);
    }
    const dropped = history.length - kept.length;
    if (dropped <= 0) continue;
    touched++;
    removed += dropped;
    if (examples.length < 15) {
      examples.push(
        `${m.memberNumber || m._id} ${m.firstName} ${m.lastName}: ${history.length} → ${kept.length}`
      );
    }
    if (apply) {
      await Member.updateOne({ _id: m._id }, { $set: { notesHistory: kept } });
    }
  }

  console.log(`Members with duplicate notes: ${touched}`);
  console.log(`History rows ${apply ? "removed" : "would remove"}: ${removed}`);
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
