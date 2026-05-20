/**
 * Create members in MongoDB with oil account IDs for delivery import matching.
 *
 * Usage:
 *   cd server && npx tsx src/scripts/createOilImportMembers.ts [--dry-run] [--company "Vendor Name"]
 *
 * Uses MONGODB_URI (or MONGO_URL) from server/.env — point at production before running.
 * Idempotent: skips when legacyProfile.oilId already matches an existing member.
 */
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDb } from "../db.js";
import { config, hasMongoEnv } from "../config.js";
import { Member } from "../models/Member.js";
import { OilCompany } from "../models/OilCompany.js";
import { accountKeys } from "../utils/deliveryRows.js";
import { nextJuneFirstAfterSignup } from "../utils/juneBilling.js";

/** oilId, lastName, firstName (as on vendor delivery sheet) */
const MEMBERS_TO_CREATE: { oilId: string; lastName: string; firstName: string }[] = [
  { oilId: "15043-1", lastName: "ANDERSON", firstName: "BETHANY" },
  { oilId: "11340-1", lastName: "ANDERSON", firstName: "BRIAN" },
  { oilId: "13018-1", lastName: "BACHMAN", firstName: "DWIGHT" },
  { oilId: "12645-1", lastName: "BAILEY SR.", firstName: "RICHARD" },
  { oilId: "13841-1", lastName: "BAZZANI & CHARLES APMANN", firstName: "JANICE" },
  { oilId: "13145-1", lastName: "BEKMAN", firstName: "SUSANNA" },
  { oilId: "8085-1", lastName: "BERGSTROM", firstName: "DOUGLAS" },
  { oilId: "13587-1", lastName: "BERTHIAUME", firstName: "BONNIE" },
  { oilId: "4040-1", lastName: "BOISVERT", firstName: "TAMARA" },
  { oilId: "9923-1", lastName: "BOUCHARD", firstName: "LOIS" },
  { oilId: "14414-1", lastName: "CALISE", firstName: "SUZANNE" },
  { oilId: "14853-1", lastName: "CARLSON", firstName: "BEVERLY" },
  { oilId: "13159-1", lastName: "CATALDO", firstName: "LISA" },
  { oilId: "12256-1", lastName: "CELLINI", firstName: "JOHN" },
  { oilId: "13028-1", lastName: "CHANG", firstName: "ROBERT" },
  { oilId: "14096-1", lastName: "CHERNYAK", firstName: "MARK" },
  { oilId: "9795-1", lastName: "CLARK", firstName: "JOHN & KARIN" },
  { oilId: "14072-1", lastName: "DAUPHINAIS", firstName: "MARK" },
  { oilId: "14322-1", lastName: "DEMMA", firstName: "LORI" },
  { oilId: "12092-1", lastName: "DUISENBERG", firstName: "MARC" },
  { oilId: "12313-1", lastName: "EMILIO", firstName: "ANTHONY" },
];

function normCompany(name: string): string {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
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
  const companyArgIdx = process.argv.indexOf("--company");
  const companyName =
    (companyArgIdx >= 0 ? process.argv[companyArgIdx + 1] : "") ||
    process.env.OIL_COMPANY_NAME?.trim() ||
    "";

  const hostHint = config.mongoUri.includes("127.0.0.1") || config.mongoUri.includes("localhost")
    ? "LOCAL"
    : "REMOTE";
  console.log(`Mongo target: ${hostHint}${hasMongoEnv() ? "" : " (default local — set MONGODB_URI)"}`);
  if (!dryRun && hostHint === "LOCAL") {
    console.error("Refusing to write: MONGODB_URI looks local. Set production URI in server/.env or use --dry-run.");
    process.exit(1);
  }

  await connectDb();

  let oilCompanyId: mongoose.Types.ObjectId | null = null;
  if (companyName) {
    const all = await OilCompany.find().lean();
    const match = all.find((c) => normCompany(c.name) === normCompany(companyName));
    if (match) oilCompanyId = new mongoose.Types.ObjectId(String(match._id));
    else console.warn(`Warning: oil company not found in DB: "${companyName}" (oilCompanyName will still be set on legacyProfile)`);
  } else {
    const all = await OilCompany.find().sort({ name: 1 }).select("name").lean();
    if (all.length) {
      console.log("Oil companies in DB (pass --company \"Name\" for delivery import matching):");
      for (const c of all) console.log(`  - ${c.name}`);
    }
  }

  const passwordHash = dryRun
    ? ""
    : await bcrypt.hash(`Setup-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`, 10);
  let created = 0;
  let skipped = 0;
  let updated = 0;
  let nextNum = await nextMemberNumber();

  for (let i = 0; i < MEMBERS_TO_CREATE.length; i++) {
    const { oilId, lastName, firstName } = MEMBERS_TO_CREATE[i];
    const existing = await findMemberByOilId(oilId);

    if (existing) {
      const lp = (existing.legacyProfile || {}) as Record<string, unknown>;
      const needsName =
        String(existing.firstName || "").toUpperCase() !== firstName ||
        String(existing.lastName || "").toUpperCase() !== lastName;
      const needsOilId = String(lp.oilId || "").trim() !== oilId;
      if (needsName || needsOilId) {
        if (dryRun) {
          console.log(`[update] ${oilId} ${firstName} ${lastName} (member ${existing.memberNumber || existing._id})`);
          updated++;
        } else {
          await Member.updateOne(
            { _id: existing._id },
            {
              $set: {
                firstName,
                lastName,
                ...(companyName ? { "legacyProfile.oilCompanyName": companyName } : {}),
                "legacyProfile.oilId": oilId,
                "legacyProfile.workbenchMemberStatus": "ACTIVE",
                "legacyProfile.importSource": "delivery-import-setup-script",
                ...(oilCompanyId ? { oilCompanyId } : {}),
              },
            }
          );
          console.log(`Updated ${oilId} → ${existing.memberNumber || existing._id}`);
          updated++;
        }
      } else {
        console.log(`Skip (exists): ${oilId} ${firstName} ${lastName} → ${existing.memberNumber || existing._id}`);
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
      console.log(`[create] ${memberNumber} ${oilId} ${firstName} ${lastName} <${email}>`);
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
