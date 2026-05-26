/**
 * Create members in MongoDB with oil account IDs for delivery import matching.
 *
 * Usage:
 *   cd server && npx tsx src/scripts/createOilImportMembers.ts [--dry-run] [--company "Ives Brothers"] [--file path/to.xlsx] [--allow-local]
 *
 * Uses MONGODB_URI from server/.env, or Railway env when run via `railway run`.
 * Idempotent: skips when legacyProfile.oilId already matches an existing member.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import * as XLSX from "xlsx";
import { connectDb } from "../db.js";
import { config, hasMongoEnv } from "../config.js";
import { Member } from "../models/Member.js";
import { OilCompany } from "../models/OilCompany.js";
import { accountKeys } from "../utils/deliveryRows.js";
import { nextJuneFirstAfterSignup } from "../utils/juneBilling.js";

type RowToCreate = { oilId: string; lastName: string; firstName: string };

function normCompany(name: string): string {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parseMembersFromXlsx(filePath: string): RowToCreate[] {
  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const wsName = wb.SheetNames[0];
  if (!wsName) throw new Error("no sheets in workbook");
  const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wsName], { header: 1, defval: "" });
  if (!grid.length) return [];
  const header = (grid[0] || []).map((c) => String(c ?? "").trim().toLowerCase());
  const col = (name: string) => header.findIndex((h) => h === name.toLowerCase());
  const accountCol = col("account");
  const lastCol = col("name last");
  const firstCol = col("name first");
  if (accountCol < 0) throw new Error('Expected "Account" column in row 1');

  const out: RowToCreate[] = [];
  const seen = new Set<string>();
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r] || [];
    const oilId = String(row[accountCol] ?? "").trim();
    if (!oilId) continue;
    const key = oilId.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const lastName = (lastCol >= 0 ? String(row[lastCol] ?? "") : "").trim().toUpperCase();
    const firstName = (firstCol >= 0 ? String(row[firstCol] ?? "") : "").trim().toUpperCase();
    out.push({ oilId, firstName: firstName || "—", lastName: lastName || "—" });
  }
  return out;
}

async function nextMemberNumber(): Promise<string> {
  const last = (await Member.findOne({ role: "member", memberNumber: { $regex: /^OC-\d+$/ } })
    .sort({ createdAt: -1 })
    .select("memberNumber")
    .lean()) as { memberNumber?: string } | null;
  const n = last?.memberNumber ? Number(last.memberNumber.replace("OC-", "")) : 1000;
  return `OC-${String((Number.isFinite(n) ? n : 1000) + 1).padStart(6, "0")}`;
}

function syntheticEmail(oilId: string, n: number): string {
  const slug = oilId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `delivery-setup-${slug}-${n}@oilcoop.local`;
}

async function findMemberByOilId(oilId: string) {
  const want = new Set(accountKeys(oilId));
  if (want.size === 0) return null;
  const rows = await Member.find({ "legacyProfile.oilId": { $exists: true, $ne: "" } })
    .select("memberNumber firstName lastName legacyProfile")
    .lean();
  for (const m of rows) {
    const stored = String((m.legacyProfile as Record<string, unknown>)?.oilId || "");
    for (const k of accountKeys(stored)) {
      if (want.has(k)) return m;
    }
  }
  return null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const allowLocal = process.argv.includes("--allow-local");
  const companyArgIdx = process.argv.indexOf("--company");
  const fileArgIdx = process.argv.indexOf("--file");
  const companyName =
    (companyArgIdx >= 0 ? process.argv[companyArgIdx + 1] : "") ||
    process.env.OIL_COMPANY_NAME?.trim() ||
    "Ives Brothers";
  const filePath = fileArgIdx >= 0 ? process.argv[fileArgIdx + 1] : "";

  const hostHint = config.mongoUri.includes("127.0.0.1") || config.mongoUri.includes("localhost")
    ? "LOCAL"
    : "REMOTE";
  console.log(`Mongo target: ${hostHint}${hasMongoEnv() ? "" : " (default local — set MONGODB_URI)"}`);
  if (!dryRun && hostHint === "LOCAL" && !allowLocal) {
    console.error("Refusing to write: MONGODB_URI looks local. Use --allow-local for dev DB, or railway run for prod.");
    process.exit(1);
  }

  let membersToCreate: RowToCreate[];
  if (filePath) {
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    membersToCreate = parseMembersFromXlsx(filePath);
    console.log(`Loaded ${membersToCreate.length} unique accounts from ${filePath}`);
  } else {
    console.error("Pass --file path/to/delivery-summary.xlsx");
    process.exit(1);
  }

  await connectDb();

  let oilCompanyId: mongoose.Types.ObjectId | null = null;
  if (companyName) {
    const all = await OilCompany.find().lean();
    const match = all.find((c) => normCompany(c.name) === normCompany(companyName));
    if (match) oilCompanyId = new mongoose.Types.ObjectId(String(match._id));
    else console.warn(`Warning: oil company not found: "${companyName}"`);
  }

  const passwordHash = dryRun
    ? ""
    : await bcrypt.hash(`Setup-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`, 10);
  let created = 0;
  let skipped = 0;
  let updated = 0;
  let nextNum = await nextMemberNumber();

  for (let i = 0; i < membersToCreate.length; i++) {
    const { oilId, lastName, firstName } = membersToCreate[i];
    const existing = await findMemberByOilId(oilId);

    if (existing) {
      const lp = (existing.legacyProfile || {}) as Record<string, unknown>;
      const needsName =
        String(existing.firstName || "").toUpperCase() !== firstName ||
        String(existing.lastName || "").toUpperCase() !== lastName;
      const needsOilId = String(lp.oilId || "").trim() !== oilId;
      const needsCo = companyName && normCompany(String(lp.oilCompanyName || "")) !== normCompany(companyName);
      if (needsName || needsOilId || needsCo) {
        if (dryRun) {
          console.log(`[update] ${oilId} ${firstName} ${lastName}`);
          updated++;
        } else {
          await Member.updateOne(
            { _id: existing._id },
            {
              $set: {
                firstName,
                lastName,
                "legacyProfile.oilId": oilId,
                "legacyProfile.workbenchMemberStatus": "ACTIVE",
                "legacyProfile.importSource": "delivery-import-setup-script",
                ...(companyName ? { "legacyProfile.oilCompanyName": companyName } : {}),
                ...(oilCompanyId ? { oilCompanyId } : {}),
              },
            }
          );
          console.log(`Updated ${oilId} → ${existing.memberNumber || existing._id}`);
          updated++;
        }
      } else {
        skipped++;
      }
      continue;
    }

    const memberNumber = nextNum;
    if (!dryRun) {
      const n = Number(memberNumber.replace("OC-", ""));
      nextNum = `OC-${String(n + 1).padStart(6, "0")}`;
    }
    const email = syntheticEmail(oilId, i);
    const legacyProfile: Record<string, unknown> = {
      oilId,
      workbenchMemberStatus: "ACTIVE",
      oilWorkbenchStatus: "ACTIVE",
      importSource: "delivery-import-setup-script",
    };
    if (companyName) legacyProfile.oilCompanyName = companyName;

    if (dryRun) {
      console.log(`[create] ${memberNumber} ${oilId} ${firstName} ${lastName}`);
      created++;
      continue;
    }

    await Member.create({
      memberNumber,
      email,
      passwordHash,
      firstName,
      lastName,
      role: "member",
      status: "active",
      paymentMethod: "check",
      autoRenew: false,
      signedUpVia: "admin",
      nextAnnualBillingDate: nextJuneFirstAfterSignup(new Date()),
      ...(oilCompanyId ? { oilCompanyId } : {}),
      legacyProfile,
    });
    console.log(`Created ${memberNumber} ${oilId} ${firstName} ${lastName}`);
    created++;
  }

  console.log(`\nDone (${dryRun ? "dry run" : "applied"}): created=${created} updated=${updated} skipped=${skipped}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
