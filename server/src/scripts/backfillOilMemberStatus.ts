/**
 * Restore oil-status radios from the Approach OIL_MEMBER column.
 *
 * The original coop transfer copied membership active/dropped onto
 * legacyProfile.oilWorkbenchStatus. Propane used PROPANE_ME. OIL_MEMBER
 * (ACTIVE, INACTIVE, PROSPECTIVE, RESIDENT, NO OIL, UNKNOWN) was skipped.
 *
 * Matches CT-{ID} / legacyProfile.legacyId and sets only oilWorkbenchStatus.
 * Dry run unless --apply is passed.
 *
 *   cd server && npx tsx src/scripts/backfillOilMemberStatus.ts --file "/path/to/Oil Co-op First TRANSFER.TXT"
 *   cd server && npx tsx src/scripts/backfillOilMemberStatus.ts --file "/path/to/....TXT" --apply
 */
import fs from "node:fs";
import { connectDb } from "../db.js";
import { config } from "../config.js";
import { Member } from "../models/Member.js";
import { approachFuelStatus } from "../utils/legacyImport.js";

const apply = process.argv.includes("--apply");
const fileIdx = process.argv.indexOf("--file");
const filePath = fileIdx >= 0 ? process.argv[fileIdx + 1] : "";

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
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { cur.push(field); field = ""; }
    else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""));
}

async function main() {
  if (!filePath || !fs.existsSync(filePath)) {
    console.error("Pass --file pointing at Oil Co-op First TRANSFER.TXT");
    process.exit(1);
  }
  const table = parseCsv(fs.readFileSync(filePath, "utf8"));
  const headers = table[0].map((h) => h.trim());
  const idCol = headers.indexOf("ID");
  const oilCol = headers.findIndex((h) => h.toUpperCase() === "OIL_MEMBER");
  if (idCol < 0 || oilCol < 0) {
    console.error("Transfer file is missing ID or OIL_MEMBER");
    process.exit(1);
  }

  const byId = new Map<string, string>();
  for (const row of table.slice(1)) {
    const id = (row[idCol] || "").trim();
    if (!id) continue;
    byId.set(id, approachFuelStatus(row[oilCol] || ""));
  }

  const remote = !/127\.0\.0\.1|localhost/.test(config.mongoUri);
  console.log(`Mongo target: ${remote ? "REMOTE" : "LOCAL"}`);
  console.log(`Mode:         ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`Approach rows: ${byId.size}`);

  await connectDb();
  const members = await Member.find({
    $or: [
      { memberNumber: { $in: [...byId.keys()].map((id) => `CT-${id}`) } },
      { "legacyProfile.legacyId": { $in: [...byId.keys()] } },
    ],
  })
    .select("memberNumber legacyProfile.legacyId legacyProfile.oilWorkbenchStatus legacyProfile.importSource")
    .lean();

  const transitions = new Map<string, number>();
  const ops: Array<{ updateOne: { filter: { _id: unknown }; update: { $set: Record<string, string> } } }> = [];
  let unchanged = 0;
  const seen = new Set<string>();

  for (const member of members) {
    const lp = (member.legacyProfile || {}) as { legacyId?: string; oilWorkbenchStatus?: string; importSource?: string };
    const id = String(lp.legacyId || "").trim() || String(member.memberNumber || "").replace(/^CT-/, "");
    if (!byId.has(id) || seen.has(String(member._id))) continue;
    // RI and later imports share some ids. Only the coop transfer used OIL_MEMBER.
    const fromTransfer = lp.importSource === "coop-main-transfer" || String(member.memberNumber || "").startsWith("CT-");
    if (!fromTransfer) continue;
    seen.add(String(member._id));
    const next = byId.get(id)!;
    const current = String(lp.oilWorkbenchStatus || "").trim().toUpperCase();
    if (current === next) {
      unchanged++;
      continue;
    }
    const key = `${current || "(blank)"} → ${next}`;
    transitions.set(key, (transitions.get(key) || 0) + 1);
    ops.push({
      updateOne: {
        filter: { _id: member._id },
        update: { $set: { "legacyProfile.oilWorkbenchStatus": next } },
      },
    });
  }

  console.log(`Matched members: ${seen.size}`);
  console.log(`Already correct: ${unchanged}`);
  console.log(`To update:       ${ops.length}`);
  const ranked = [...transitions.entries()].sort((a, b) => b[1] - a[1]);
  for (const [label, count] of ranked) console.log(`  ${count.toString().padStart(6)}  ${label}`);

  if (apply && ops.length) {
    const BATCH = 500;
    for (let i = 0; i < ops.length; i += BATCH) {
      await Member.bulkWrite(ops.slice(i, i + BATCH), { ordered: false });
    }
    console.log("Wrote oilWorkbenchStatus from OIL_MEMBER.");
  } else if (!apply) {
    console.log("Dry run only. Re-run with --apply to write.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
