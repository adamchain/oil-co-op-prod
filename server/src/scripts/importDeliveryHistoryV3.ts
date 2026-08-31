/**
 * Import standalone delivery history from "delivery history v3.TXT".
 *
 * Matches rows to existing members via legacyProfile.legacyId === MEMBER_ID.
 * Rows with no matching member are skipped and reported.
 *
 * Idempotent: rows tagged importBatchId="delivery-history-v3" are replaced on
 * each run, so re-running won't duplicate deliveries.
 *
 * Safety: DRY RUN by default.  Pass --apply to write.
 *
 * Run:
 *   cd server && MONGODB_URI='mongodb+srv://...' npx tsx src/scripts/importDeliveryHistoryV3.ts [--apply] [--file /path/to/file.TXT]
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { connectDb } from "../db.js";
import { config } from "../config.js";
import { Member } from "../models/Member.js";
import { normalizeRows, sortRowsDesc, type DeliveryRow } from "../utils/deliveryRows.js";

const BATCH_ID = "delivery-history-v3";
const DEFAULT_FILE = path.resolve("/Users/adamchain/Downloads/delivery history v3.TXT");

// ---------------------------------------------------------------------------
// CSV parser
// ---------------------------------------------------------------------------
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c !== "\r") { field += c; }
    }
  }
  if (field || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""));
}

function toObj(headers: string[], row: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((h, i) => { out[h] = (row[i] ?? "").trim(); });
  return out;
}

// ---------------------------------------------------------------------------
// Month/year parser: "04-APRIL" + "2021" → "2021-04-01"
// ---------------------------------------------------------------------------
const MONTH_NAMES: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};
function parseMonthYear(dateDeliv: string, delivYear: string): string | null {
  const year = delivYear.match(/\d{4}/)?.[0];
  if (!year) return null;
  const numMatch = dateDeliv.match(/^(\d{1,2})/);
  if (numMatch) {
    const mm = numMatch[1].padStart(2, "0");
    if (Number(mm) >= 1 && Number(mm) <= 12) return `${year}-${mm}-01`;
  }
  const raw = dateDeliv.toLowerCase();
  for (const [name, mm] of Object.entries(MONTH_NAMES)) {
    if (raw.includes(name.slice(0, 3))) return `${year}-${mm}-01`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------
type DeliveryRecord = {
  memberId: string;
  dateDelivered: string;
  year: number;
  gallons: number;
  fuelType: "OIL" | "PROPANE";
};

function parseFile(filePath: string): DeliveryRecord[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const rows = parseCsv(raw);
  if (rows.length < 2) return [];
  const headers = rows[0];
  const out: DeliveryRecord[] = [];
  let skippedNoId = 0;
  let skippedBadDate = 0;
  let skippedBadGallons = 0;
  for (const row of rows.slice(1)) {
    const r = toObj(headers, row);
    const memberId = r.MEMBER_ID?.trim();
    if (!memberId) { skippedNoId++; continue; }
    const gallons = parseFloat(r.GALLONS_DE || "0");
    if (!Number.isFinite(gallons) || gallons <= 0) { skippedBadGallons++; continue; }
    const date = parseMonthYear(r.DATE_DELIV || "", r.DELIVERY_Y || "");
    if (!date) { skippedBadDate++; continue; }
    const year = parseInt(r.DELIVERY_Y || "0", 10);
    const fuelType = (r.DELIVERY_O || "OIL").toUpperCase().startsWith("PROP") ? "PROPANE" : "OIL";
    out.push({ memberId, dateDelivered: date, year, gallons, fuelType });
  }
  if (skippedNoId) console.log(`  Skipped (no MEMBER_ID):    ${skippedNoId}`);
  if (skippedBadDate) console.log(`  Skipped (unparseable date): ${skippedBadDate}`);
  if (skippedBadGallons) console.log(`  Skipped (bad gallons):      ${skippedBadGallons}`);
  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const apply = process.argv.includes("--apply");
  const fileIdx = process.argv.indexOf("--file");
  const filePath = fileIdx >= 0
    ? path.resolve(process.argv[fileIdx + 1] ?? "")
    : DEFAULT_FILE;

  const isRemote = !/127\.0\.0\.1|localhost/.test(config.mongoUri);
  console.log(`\nMongo target: ${isRemote ? "REMOTE (prod)" : "LOCAL"} — ${config.mongoUri.replace(/:\/\/[^@]*@/, "://***@")}`);
  console.log(`Mode:         ${apply ? "APPLY (writes enabled)" : "DRY RUN (no writes)"}`);
  console.log(`File:         ${filePath}\n`);

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  console.log("Parsing file...");
  const records = parseFile(filePath);
  console.log(`  Valid delivery records:    ${records.length}\n`);

  // Group by memberId
  const byMemberId = new Map<string, DeliveryRecord[]>();
  for (const rec of records) {
    const arr = byMemberId.get(rec.memberId) ?? [];
    arr.push(rec);
    byMemberId.set(rec.memberId, arr);
  }
  console.log(`Unique MEMBER_IDs in file: ${byMemberId.size}`);

  await connectDb();

  // Load all members that have a legacyId matching any MEMBER_ID in the file
  const legacyIds = [...byMemberId.keys()];
  const members = await Member.find({ "legacyProfile.legacyId": { $in: legacyIds } })
    .select("_id legacyProfile")
    .lean();

  const memberByLegacyId = new Map<string, (typeof members)[0]>();
  for (const m of members) {
    const lid = String((m.legacyProfile as Record<string, unknown> | undefined)?.legacyId ?? "").trim();
    if (lid) memberByLegacyId.set(lid, m);
  }

  console.log(`Members matched in DB:     ${memberByLegacyId.size}`);
  const unmatchedIds = legacyIds.filter((id) => !memberByLegacyId.has(id));
  console.log(`Unmatched MEMBER_IDs:      ${unmatchedIds.length}\n`);

  let updated = 0;
  let totalRowsAdded = 0;

  type BulkOp = { updateOne: { filter: object; update: object } };
  const BATCH_SIZE = 500;
  let batch: BulkOp[] = [];

  async function flushBatch() {
    if (!batch.length) return;
    await Member.bulkWrite(batch, { ordered: false });
    batch = [];
  }

  for (const [legacyId, delivs] of byMemberId) {
    const member = memberByLegacyId.get(legacyId);
    if (!member) continue;

    const lp = (member.legacyProfile as Record<string, unknown> | undefined) ?? {};
    const existing = normalizeRows(lp.deliveryHistoryRows);

    // Remove rows from a previous run of this batch so re-runs are idempotent
    const kept = existing.filter((r) => r.importBatchId !== BATCH_ID);

    const newRows: DeliveryRow[] = delivs.map((d) => ({
      _id: crypto.randomUUID(),
      dateDelivered: d.dateDelivered,
      deliveryYear: d.year,
      fuelType: d.fuelType,
      gallons: d.gallons,
      source: "import" as const,
      importBatchId: BATCH_ID,
    }));

    const merged = sortRowsDesc([...kept, ...newRows]);

    if (apply) {
      batch.push({
        updateOne: {
          filter: { _id: member._id },
          update: { $set: { "legacyProfile.deliveryHistoryRows": merged } },
        },
      });
      if (batch.length >= BATCH_SIZE) {
        await flushBatch();
        process.stdout.write(`\r  Flushed ${updated + batch.length} / ${memberByLegacyId.size}...`);
      }
    }

    updated++;
    totalRowsAdded += newRows.length;
  }

  if (apply) {
    await flushBatch();
    process.stdout.write("\n");
  }

  console.log(`Members ${apply ? "updated" : "would update"}: ${updated}`);
  console.log(`Delivery rows ${apply ? "written" : "would write"}: ${totalRowsAdded}`);

  if (unmatchedIds.length > 0 && unmatchedIds.length <= 50) {
    console.log(`\nUnmatched IDs: ${unmatchedIds.join(", ")}`);
  } else if (unmatchedIds.length > 50) {
    console.log(`\nFirst 50 unmatched IDs: ${unmatchedIds.slice(0, 50).join(", ")}`);
  }

  if (!apply) {
    console.log("\nDRY RUN complete — no changes written. Re-run with --apply to commit.");
  }

  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
