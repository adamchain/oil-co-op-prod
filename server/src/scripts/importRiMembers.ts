/**
 * Import legacy RI Members CSV (exported from the old FileMaker database)
 * into the Mongo Member collection.
 *
 * Run with:
 *   cd server && npx tsx src/scripts/importRiMembers.ts [path/to/file.csv]
 * Default path: server/data/ri-members.csv
 *
 * Matching: by legacyProfile.legacyId (original ID column) to make this
 * script idempotent — running it twice only updates existing records.
 * Every raw CSV column is preserved under legacyProfile.* for the workbench
 * "Legacy UI" tab to display. Core fields (name/address/phone/email) are also
 * copied onto the normalized Member fields.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDb } from "../db.js";
import { Member } from "../models/Member.js";
import { OilCompany } from "../models/OilCompany.js";
import { nextJuneFirstAfterSignup } from "../utils/juneBilling.js";

/** Tiny CSV parser that handles quoted fields and embedded newlines. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        cur.push(field);
        field = "";
      } else if (c === "\n") {
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = "";
      } else if (c === "\r") {
        // ignore
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""));
}

function rowToObj(headers: string[], row: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((h, i) => {
    out[h] = (row[i] ?? "").trim();
  });
  return out;
}

function syntheticEmail(legacyId: string, first: string, last: string): string {
  const slug = `${first}.${last}`
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, "")
    .slice(0, 40) || "member";
  return `legacy-${legacyId}-${slug}@import.oilcoop.local`;
}

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const defaultPath = path.resolve(here, "../../data/ri-members.csv");
  const csvPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultPath;

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }

  await connectDb();
  console.log(`Importing from ${csvPath}`);

  const raw = fs.readFileSync(csvPath, "utf8");
  const rows = parseCsv(raw);
  if (rows.length < 2) {
    console.error("CSV has no data rows");
    process.exit(1);
  }
  const headers = rows[0];
  const dataRows = rows.slice(1);

  // Cache oil companies by name so we can link them.
  const oilCos = (await OilCompany.find({}).lean()) as unknown as Array<{
    _id: mongoose.Types.ObjectId;
    name: string;
  }>;
  const ocByKey = new Map<string, mongoose.Types.ObjectId>();
  for (const oc of oilCos) {
    ocByKey.set(oc.name.trim().toLowerCase(), oc._id);
  }

  const defaultHash = await bcrypt.hash(`legacy-${Date.now()}-${Math.random()}`, 10);
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of dataRows) {
    const r = rowToObj(headers, row);
    if (r.DELETED && r.DELETED.toLowerCase() === "y") {
      skipped++;
      continue;
    }
    const legacyId = (r.ID || "").trim();
    if (!legacyId) {
      skipped++;
      continue;
    }

    const firstName = r.F_NAME_1 || "Unknown";
    const lastName = r.L_NAME_1 || legacyId;
    const email =
      (r.E_MAIL || "").toLowerCase().trim() || syntheticEmail(legacyId, firstName, lastName);
    const phone = r.PHONE_1 ? `(${r.ACODE_1 || ""}) ${r.PHONE_1}` : r.PHONE_2 ? `(${r.ACODE_2 || ""}) ${r.PHONE_2}` : "";

    const addressLine1 = [r.STREET_NO, r.STREET_NM].filter(Boolean).join(" ").trim();
    const addressLine2 = r.APT_NO_1 ? `Apt ${r.APT_NO_1}` : "";

    const legacyProfile: Record<string, unknown> = {
      legacyId,
      recordType: r.REC_TYPE || "IND",
      midName1: r.M_NAME_1 || "",
      firstName2: r.F_NAME_2 || "",
      midName2: r.M_NAME_2 || "",
      lastName2: r.L_NAME_2 || "",
      mf1: r.MF_1 || "",
      mf2: r.MF_2 || "",
      streetNo: r.STREET_NO || "",
      aptNo1: r.APT_NO_1 || "",
      plus4: r.PLUS_4 || "",
      phone2: r.PHONE_2 ? `(${r.ACODE_2 || ""}) ${r.PHONE_2}` : "",
      company: r.COMPANY || "",
      carrierRt: r.CARRIER_RT || "",
      keyCodes: r.KEY_CODES || "",
      oilCoRaw: r.OIL_CO || "",
      oilId: r.OIL_ID || "",
      generation1: r.GENER_1 || "",
      generation2: r.GENER_2 || "",
      formal1: r.FORMAL1 || "",
      formal2: r.FORMAL2 || "",
      pref1: r.PREF_1 || "",
      pref2: r.PREF_2 || "",
      lastUser: r.LAST_USER || "",
      dateAdd: r.DATE_ADD || "",
      dateUpdat: r.DATE_UPDAT || "",
      workbenchMemberStatus: "ACTIVE",
      importSource: "ri-members-csv",
    };

    const oilCompanyId =
      (r.OIL_CO && ocByKey.get(r.OIL_CO.trim().toLowerCase())) || null;

    const existing = await Member.findOne({ "legacyProfile.legacyId": legacyId });

    if (existing) {
      existing.firstName = firstName;
      existing.lastName = lastName;
      existing.phone = phone;
      existing.addressLine1 = addressLine1;
      existing.addressLine2 = addressLine2;
      existing.city = r.CITY || "";
      existing.state = r.STATE || "RI";
      existing.postalCode = r.ZIP || "";
      existing.notes = r.NOTE || existing.notes;
      existing.legacyProfile = { ...(existing.legacyProfile || {}), ...legacyProfile };
      if (oilCompanyId) existing.oilCompanyId = oilCompanyId;
      await existing.save();
      updated++;
      continue;
    }

    // Avoid unique-email collisions (synthetic emails must still be unique).
    const existsByEmail = await Member.findOne({ email }).lean();
    const finalEmail = existsByEmail ? syntheticEmail(legacyId, firstName, lastName) : email;

    await Member.create({
      memberNumber: `RI-${legacyId}`,
      email: finalEmail,
      passwordHash: defaultHash,
      firstName,
      lastName,
      phone,
      addressLine1,
      addressLine2,
      city: r.CITY || "",
      state: r.STATE || "RI",
      postalCode: r.ZIP || "",
      role: "member",
      status: "active",
      oilCompanyId,
      paymentMethod: "check",
      autoRenew: false,
      nextAnnualBillingDate: nextJuneFirstAfterSignup(new Date()),
      signedUpVia: "admin",
      notes: r.NOTE || "",
      legacyProfile,
    });
    created++;
  }

  console.log(`Import complete: created=${created} updated=${updated} skipped=${skipped}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
