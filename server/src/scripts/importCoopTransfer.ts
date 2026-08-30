/**
 * Import the full Oil Co-Op FileMaker database transfer (10 TXT files) into MongoDB.
 *
 * Sources (pass --dir to override):
 *   default: /tmp/oil-import/Oil Co-Op Transfer Files/
 *
 * What gets imported:
 *   1. Oil + Propane company info → upserted into OilCompany collection by name
 *   2. Main member roster (First TRANSFER.TXT) → upserted by memberNumber "CT-{ID}"
 *   3. Delivery history → legacyProfile.deliveryHistoryRows (matched by MEMBER_ID)
 *   4. Contact history → notesHistory entries (matched by ID)
 *   5. Payments received → legacyProfile.paymentsHistory (matched by ID)
 *   6. Program history → legacyProfile.programHistory (matched by MEMBER_ID)
 *
 * Safety: DRY RUN by default.  Pass --apply to write to the database.
 *
 * Run:
 *   cd server && MONGODB_URI='mongodb+srv://...' npx tsx src/scripts/importCoopTransfer.ts [--apply] [--dir /path/to/files]
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDb } from "../db.js";
import { config } from "../config.js";
import { Member } from "../models/Member.js";
import { OilCompany } from "../models/OilCompany.js";
import { Referral } from "../models/Referral.js";
import { normalizeRows, sortRowsDesc, type DeliveryRow } from "../utils/deliveryRows.js";
import { nextJuneFirstAfterSignup } from "../utils/juneBilling.js";
import { formatApproachPhone, parseLegacyDate, parseLegacyYes, pickField } from "../utils/legacyImport.js";

// ---------------------------------------------------------------------------
// CSV parser (handles quoted fields + embedded newlines)
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
// Normalisation helpers
// ---------------------------------------------------------------------------
function syntheticEmail(id: string, first: string, last: string): string {
  const slug = `${first}.${last}`.toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 40) || "member";
  return `ct-${id}-${slug}@import.oilcoop.local`;
}

// Delivery month parser: "03-MARCH" → "03" or "MARCH" → "03"
const MONTH_NAMES: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};
function parseMonthYear(dateDeliv: string, delivYear: string): string | null {
  const year = delivYear.match(/\d{4}/)?.[0];
  if (!year) return null;
  const raw = dateDeliv.toLowerCase().replace(/[^a-z0-9]+/g, "");
  // Try numeric prefix first ("03march" → "03")
  const numMatch = dateDeliv.match(/^(\d{1,2})/);
  if (numMatch) {
    const mm = numMatch[1].padStart(2, "0");
    if (Number(mm) >= 1 && Number(mm) <= 12) return `${year}-${mm}-01`;
  }
  // Try month name
  for (const [name, mm] of Object.entries(MONTH_NAMES)) {
    if (raw.includes(name.slice(0, 3))) return `${year}-${mm}-01`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// File parsers
// ---------------------------------------------------------------------------

type OilCoRow = { code: string; name: string; phone: string; email: string; contact: string };
function parseCompanyFile(filePath: string, codeCol: string, nameCol: string, phoneCol: string, emailCol: string, contactCol: string): OilCoRow[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const rows = parseCsv(raw);
  if (rows.length < 2) return [];
  const headers = rows[0];
  const seen = new Set<string>();
  const out: OilCoRow[] = [];
  for (const row of rows.slice(1)) {
    const r = toObj(headers, row);
    const code = r[codeCol] || "";
    const name = r[nameCol] || "";
    if (!code || !name) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    out.push({ code, name, phone: r[phoneCol] || "", email: r[emailCol] || "", contact: r[contactCol] || "" });
  }
  return out;
}

type MemberRow = Record<string, string>;
function parseMemberFile(filePath: string): { headers: string[]; rows: MemberRow[] } {
  const raw = fs.readFileSync(filePath, "utf8");
  const rows = parseCsv(raw);
  if (rows.length < 2) return { headers: [], rows: [] };
  const headers = rows[0];
  return { headers, rows: rows.slice(1).map((r) => toObj(headers, r)) };
}

type DeliveryRecord = { memberId: string; dateDelivered: string; year: number; gallons: number; fuelType: "OIL" | "PROPANE"; oilId: string };
function parseDeliveryFile(filePath: string): DeliveryRecord[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const rows = parseCsv(raw);
  if (rows.length < 2) return [];
  const headers = rows[0];
  const out: DeliveryRecord[] = [];
  for (const row of rows.slice(1)) {
    const r = toObj(headers, row);
    const memberId = r.MEMBER_ID || "";
    const gallons = parseFloat(r.GALLONS_DE || "0");
    if (!memberId || !Number.isFinite(gallons) || gallons <= 0) continue;
    const date = parseMonthYear(r.DATE_DELIV || "", r.DELIVERY_Y || "");
    if (!date) continue;
    const year = parseInt(r.DELIVERY_Y || "0", 10);
    const fuelType = (r.DELIVERY_O || "OIL").toUpperCase().startsWith("PROP") ? "PROPANE" : "OIL";
    out.push({ memberId, dateDelivered: date, year, gallons, fuelType, oilId: r.OIL_ID || "" });
  }
  return out;
}

type ContactRecord = { memberId: string; date: string; notes: string };
function parseContactFile(filePath: string): ContactRecord[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const rows = parseCsv(raw);
  if (rows.length < 2) return [];
  const headers = rows[0];
  const out: ContactRecord[] = [];
  for (const row of rows.slice(1)) {
    const r = toObj(headers, row);
    if (!r.ID || !r.NOTES) continue;
    out.push({ memberId: r.ID, date: r.DATE || "", notes: r.NOTES });
  }
  return out;
}

type PaymentRecord = {
  memberId: string; date: string; billingYear: number; amountCents: number;
  paymentMethod: string; checkNumber: string; feeWaived: boolean; entryType: string;
};
function parsePaymentsFile(filePath: string): PaymentRecord[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const rows = parseCsv(raw);
  if (rows.length < 2) return [];
  const headers = rows[0];
  const out: PaymentRecord[] = [];
  for (const row of rows.slice(1)) {
    const r = toObj(headers, row);
    if (!r.ID) continue;
    const amountRaw = parseFloat(r.AMOUNT_REC || "0");
    out.push({
      memberId: r.ID,
      date: r.DATE_RECEI || "",
      billingYear: parseInt(r.BILLING_YE || "0", 10) || 0,
      amountCents: Number.isFinite(amountRaw) ? Math.round(amountRaw * 100) : 0,
      paymentMethod: r.PAYMENT_ME || "",
      checkNumber: r.CHECK_NUMB || "",
      feeWaived: (r.FEE_WAIVED || "").toLowerCase() === "yes",
      entryType: r.NEW_RENEW || "",
    });
  }
  return out;
}

type ProgramRecord = { memberId: string; program: string; rate: string; heatingYear: number; estGallons: string; cluster: string };
function parseProgramFile(filePath: string): ProgramRecord[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const rows = parseCsv(raw);
  if (rows.length < 2) return [];
  const headers = rows[0];
  const out: ProgramRecord[] = [];
  for (const row of rows.slice(1)) {
    const r = toObj(headers, row);
    if (!r.MEMBER_ID || !r.OIL_PROGRA) continue;
    out.push({
      memberId: r.MEMBER_ID,
      program: r.OIL_PROGRA || "",
      rate: r.RATE || "",
      heatingYear: parseInt(r.HEATING_YE || "0", 10) || 0,
      estGallons: r.EST_GALLON || "",
      cluster: r.CLUSTER || "",
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const apply = process.argv.includes("--apply");
  const dirIdx = process.argv.indexOf("--dir");
  const dir = dirIdx >= 0
    ? path.resolve(process.argv[dirIdx + 1] ?? "")
    : "/tmp/oil-import/Oil Co-Op Transfer Files";

  const isRemote = !/127\.0\.0\.1|localhost/.test(config.mongoUri);
  console.log(`\nMongo target: ${isRemote ? "REMOTE (prod)" : "LOCAL"} — ${config.mongoUri.replace(/:\/\/[^@]*@/, "://***@")}`);
  console.log(`Mode:         ${apply ? "APPLY (writes enabled)" : "DRY RUN (no writes)"}`);
  console.log(`Source dir:   ${dir}\n`);

  if (!fs.existsSync(dir)) { console.error(`Directory not found: ${dir}`); process.exit(1); }

  // Resolve file paths
  const f = (name: string) => path.join(dir, name);
  const firstFile     = f("Oil Co-op First TRANSFER.TXT");
  const delivFile     = f("Oil Co-op Delivery History TRANSFER.TXT");
  const payFile       = f("Oil Co-op Payments Received TRANSFER.TXT");
  const contactFile   = f("Oil Co-op Contact History TRANSFER.TXT");
  const programFile   = f("Oil Co-op Program  History TRANSFER.TXT");
  const oilCoFile     = f("Oil Co-op Oil Company Info TRANSFER.TXT");
  const propCoFile    = f("Oil Co-op Propane Company Info TRANSFER.TXT");

  for (const fp of [firstFile, delivFile, payFile, contactFile, programFile, oilCoFile, propCoFile]) {
    if (!fs.existsSync(fp)) { console.error(`Missing file: ${fp}`); process.exit(1); }
  }

  // -------------------------------------------------------------------------
  // Phase 0: parse all files up front
  // -------------------------------------------------------------------------
  console.log("Parsing files...");
  const oilCos   = parseCompanyFile(oilCoFile,  "OIL_CO_COD", "OIL_CO_NAM", "OIL_CO_PHO", "OIL_CO_EMA", "OIL_CO_CON");
  const propCos  = parseCompanyFile(propCoFile, "PROP_CO_CO", "PROP_CO_NA", "PROP_CO_PH", "PROP_CO_EM", "PROP_CO_C2");
  const { rows: memberRows } = parseMemberFile(firstFile);
  const deliveries  = parseDeliveryFile(delivFile);
  const contacts    = parseContactFile(contactFile);
  const payments    = parsePaymentsFile(payFile);
  const programs    = parseProgramFile(programFile);

  console.log(`Oil companies:      ${oilCos.length} unique`);
  console.log(`Propane companies:  ${propCos.length} unique`);
  console.log(`Member rows:        ${memberRows.length}`);
  console.log(`Delivery records:   ${deliveries.length}`);
  console.log(`Contact records:    ${contacts.length}`);
  console.log(`Payment records:    ${payments.length}`);
  console.log(`Program records:    ${programs.length}`);

  await connectDb();

  // -------------------------------------------------------------------------
  // Phase 1: Upsert oil + propane companies, build code→ObjectId map
  // -------------------------------------------------------------------------
  console.log("\n--- Phase 1: Companies ---");
  const codeToOilId = new Map<string, mongoose.Types.ObjectId>();

  const allCompanies = [...oilCos, ...propCos];
  const seenName = new Map<string, mongoose.Types.ObjectId>(); // name (lower) → _id

  // Pre-load existing OilCompany records by name
  const existingCos = await OilCompany.find({}).lean() as unknown as Array<{ _id: mongoose.Types.ObjectId; name: string }>;
  for (const ec of existingCos) seenName.set(ec.name.trim().toLowerCase(), ec._id);

  let cosCreated = 0, cosMatched = 0;
  for (const co of allCompanies) {
    const nameLower = co.name.trim().toLowerCase();
    let oid = seenName.get(nameLower);
    if (!oid) {
      if (apply) {
        const doc = await OilCompany.create({
          name: co.name.trim(),
          contactPhone: co.phone,
          contactEmail: co.email,
          notes: co.contact ? `Contact: ${co.contact}` : "",
          active: true,
        });
        oid = doc._id as mongoose.Types.ObjectId;
        seenName.set(nameLower, oid);
      } else {
        // Assign a placeholder id for dry-run reporting
        oid = new mongoose.Types.ObjectId();
        seenName.set(nameLower, oid);
      }
      cosCreated++;
    } else {
      cosMatched++;
    }
    codeToOilId.set(co.code, oid);
  }
  console.log(`Companies created: ${cosCreated}  matched: ${cosMatched}`);

  // -------------------------------------------------------------------------
  // Phase 2: Parse + upsert member records
  // -------------------------------------------------------------------------
  console.log("\n--- Phase 2: Members ---");

  // Index deliveries/contacts/payments/programs by member ID string
  const delivByMemberId  = new Map<string, DeliveryRecord[]>();
  for (const d of deliveries) (delivByMemberId.get(d.memberId) ?? delivByMemberId.set(d.memberId, []).get(d.memberId)!).push(d);

  const contactByMemberId = new Map<string, ContactRecord[]>();
  for (const c of contacts) (contactByMemberId.get(c.memberId) ?? contactByMemberId.set(c.memberId, []).get(c.memberId)!).push(c);

  const payByMemberId = new Map<string, PaymentRecord[]>();
  for (const p of payments) (payByMemberId.get(p.memberId) ?? payByMemberId.set(p.memberId, []).get(p.memberId)!).push(p);

  const programByMemberId = new Map<string, ProgramRecord[]>();
  for (const p of programs) (programByMemberId.get(p.memberId) ?? programByMemberId.set(p.memberId, []).get(p.memberId)!).push(p);

  const defaultHash = apply
    ? await bcrypt.hash(`ct-import-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`, 10)
    : "placeholder-hash";

  // Pre-load all emails already in use so we can avoid collisions both from the
  // existing DB and from earlier rows in this same import run.
  const usedEmails = new Set<string>(
    (await Member.find({}, { email: 1 }).lean() as Array<{ email?: string }>)
      .map((m) => (m.email || "").toLowerCase())
      .filter(Boolean)
  );

  let created = 0, updated = 0, skipped = 0, emailCollisions = 0;
  const BATCH = 200;
  let batch: any[] = [];

  const flush = async () => {
    if (!apply || !batch.length) { batch = []; return; }
    try {
      await Member.insertMany(batch, { ordered: false });
    } catch (e: any) {
      // ordered:false continues past individual write errors; the partial result is fine.
      // Log how many failed so the summary reflects reality.
      const writeErrors: number = e?.writeErrors?.length ?? e?.result?.writeErrors?.length ?? 0;
      if (writeErrors) {
        console.warn(`  Batch: ${writeErrors} skipped (duplicate key in DB)`);
        created -= writeErrors;
        skipped += writeErrors;
      } else {
        throw e;
      }
    }
    batch = [];
  };

  for (const r of memberRows) {
    const id = r.ID || "";
    if (!id) { skipped++; continue; }
    if ((r.DELETED || "").toUpperCase() === "Y") { skipped++; continue; }

    const memberNumber = `CT-${id}`;
    const firstName = r.F_NAME_1 || "Unknown";
    const lastName  = r.L_NAME_1 || id;
    const email = (r.E_MAIL || "").toLowerCase().trim() || syntheticEmail(id, firstName, lastName);
    const phone = r.PHONE_1 ? formatApproachPhone(r.ACODE_1, r.PHONE_1) : (r.PHONE_2 ? formatApproachPhone(r.ACODE_2, r.PHONE_2) : "");
    const phone2 = r.PHONE_2 ? formatApproachPhone(r.ACODE_2, r.PHONE_2) : "";
    const phone3 = pickField(r, "PHONE_3", "PHONE3") ? formatApproachPhone(pickField(r, "ACODE_3", "ACODE3"), pickField(r, "PHONE_3", "PHONE3")) : "";
    const newMemberDt = parseLegacyDate(pickField(r, "NEW_MEMBER", "NEW_MEM_DT", "NEW_MEM_DA", "DATE_ADD"));
    const originalStartDate = parseLegacyDate(pickField(r, "ORIG_START", "ORIGINAL_S", "ORIG_DATE", "DATE_START", "START_DATE", "FIRST_DATE", "ORIGINAL_START"));
    const seniorMember = parseLegacyYes(pickField(r, "SENIOR", "SENIOR_MEM", "SENIOR_M"));
    const addressLine1 = [r.STREET_NO, r.STREET_NM].filter(Boolean).join(" ").trim();
    const addressLine2 = r.APT_NO_1 ? `Apt ${r.APT_NO_1}` : "";

    // Member status
    let status: "active" | "expired" | "cancelled" = "active";
    if (r.DROPPED_DA) status = "cancelled";
    else if ((r.DELINQUENT || "").toUpperCase() === "Y") status = "expired";

    // Lifetime / fee waived
    const lifetimeWaived = (r.LIFETIME_M || "").toLowerCase() === "yes" || (r.WAIVE_FEE_ || "").toLowerCase() === "yes";

    // Oil company link
    const oilCoCode = r.OIL_CO || "";
    const oilCompanyId = oilCoCode ? (codeToOilId.get(oilCoCode) ?? null) : null;

    // Delivery rows
    const rawDelivs = delivByMemberId.get(id) || [];
    const deliveryHistoryRows: DeliveryRow[] = sortRowsDesc(
      rawDelivs.map((d) => ({
        _id: crypto.randomUUID(),
        dateDelivered: d.dateDelivered,
        deliveryYear: d.year,
        fuelType: d.fuelType,
        gallons: d.gallons,
        source: "import" as const,
        importBatchId: "coop-main-transfer",
      }))
    );

    // Payments history
    const paymentsHistory = (payByMemberId.get(id) || []).map((p) => ({
      date: p.date,
      billingYear: p.billingYear,
      amountCents: p.amountCents,
      paymentMethod: p.paymentMethod,
      checkNumber: p.checkNumber,
      feeWaived: p.feeWaived,
      entryType: p.entryType,
    }));

    // Program history
    const programHistory = (programByMemberId.get(id) || []).map((p) => ({
      program: p.program,
      rate: p.rate,
      heatingYear: p.heatingYear,
      estGallons: p.estGallons,
      cluster: p.cluster,
    }));

    // Contact notes → notesHistory
    const contactNotes = (contactByMemberId.get(id) || []).map((c) => ({
      text: c.date ? `[${c.date}] ${c.notes}` : c.notes,
      createdAt: new Date(),
      createdBy: "legacy-import",
    }));

    const legacyProfile: Record<string, unknown> = {
      legacyId: id,
      importSource: "coop-main-transfer",
      recordType: r.REC_TYPE || "",
      midName1: r.M_NAME_1 || "",
      firstName2: r.F_NAME_2 || "",
      midName2: r.M_NAME_2 || "",
      lastName2: r.L_NAME_2 || "",
      mf1: r.MF_1 || "",
      mf2: r.MF_2 || "",
      oilCoRaw: oilCoCode,
      oilId: r.OIL_ID || "",
      propaneCoRaw: r.PROPANE_CO || "",
      propaneId: r.PROPANE_ID || "",
      howJoined: r.HOW_JOINED || "",
      oilProgram: r.OIL_PROGRA || "",
      seniorFlag: r.SENIOR || "",
      seniorMember,
      dateAdd: r.DATE_ADD || "",
      newMemberDt,
      originalStartDate,
      phone2,
      phone3,
      typePhone1: pickField(r, "TYPE_OF_PH", "TYPE_PH1", "TYPE_PHO1") || "",
      typePhone2: pickField(r, "TYPE_OF_P2", "TYPE_PH2", "TYPE_PHO2", "TYPE_PHONE2") || "",
      typePhone3: pickField(r, "TYPE_OF_P3", "TYPE_PH3", "TYPE_PHO3", "TYPE_PHONE3") || "",
      p1Ext: pickField(r, "PHONE1_EXT", "P1_EXT").replace(/\D/g, "").slice(0, 3),
      p2Ext: pickField(r, "PHONE2_EXT", "P2_EXT").replace(/\D/g, "").slice(0, 3),
      p3Ext: pickField(r, "P3_EXT", "PHONE3_EXT").replace(/\D/g, "").slice(0, 3),
      dateUpdat: r.DATE_UPDAT || "",
      droppedDate: r.DROPPED_DA || "",
      delinquent: r.DELINQUENT || "",
      company: r.COMPANY || "",
      zone: r.ZONE || "",
      cluster: r.CLUSTER || "",
      referredById: pickField(r, "REFERRED_B", "REF_BY_ID", "REFER_BY", "REFERRED_BY") || "",
      dateReferred: parseLegacyDate(pickField(r, "DATE_REFER", "DATE_REF", "DATE_REFE")) || "",
      referralSource: pickField(r, "REFERRAL_S", "REF_SOURCE", "REFERRAL_SOURCE") || "",
      nextStep: pickField(r, "NEXT_STEP") || "",
      contactNote: pickField(r, "CONTACT_NO", "CONTACT_N", "CONTACT_NOTE") || "",
      employer: pickField(r, "EMPLOYER", "EMPLOY") || "",
      callBack: parseLegacyYes(pickField(r, "CALL_BACK", "CALLBACK", "CB_FLAG", "CALL_B")),
      callBackDate: parseLegacyDate(pickField(r, "CALL_BACK_D", "CALLBDATE", "CB_DATE", "CALL_BACK_DATE")) || "",
      workbenchMemberStatus: status.toUpperCase(),
      deliveryHistoryRows,
      paymentsHistory,
      programHistory,
    };

    const existing = await Member.findOne({ memberNumber }).lean() as any;

    if (existing) {
      if (apply) {
        await Member.updateOne({ memberNumber }, {
          $set: {
            firstName, lastName, phone, addressLine1, addressLine2,
            city: r.CITY || existing.city || "",
            state: r.STATE || existing.state || "CT",
            postalCode: r.ZIP || existing.postalCode || "",
            status,
            notes: r.NOTE || existing.notes || "",
            oilCompanyId: oilCompanyId ?? existing.oilCompanyId ?? null,
            lifetimeAnnualFeeWaived: lifetimeWaived || existing.lifetimeAnnualFeeWaived,
            legacyProfile: { ...(existing.legacyProfile || {}), ...legacyProfile },
          },
          ...(contactNotes.length ? { $push: { notesHistory: { $each: contactNotes } } } : {}),
        });
      }
      updated++;
      continue;
    }

    // Avoid email uniqueness collisions (in DB and within this import run)
    let finalEmail = email;
    if (usedEmails.has(finalEmail)) {
      emailCollisions++;
      finalEmail = syntheticEmail(id, firstName, lastName);
      // If the synthetic also collides (rare), append the id to make it unique
      if (usedEmails.has(finalEmail)) finalEmail = `ct-${id}@import.oilcoop.local`;
    }
    usedEmails.add(finalEmail);

    batch.push({
      memberNumber,
      email: finalEmail,
      passwordHash: defaultHash,
      firstName,
      lastName,
      phone,
      addressLine1,
      addressLine2,
      city: r.CITY || "",
      state: r.STATE || "CT",
      postalCode: r.ZIP || "",
      role: "member",
      status,
      oilCompanyId,
      paymentMethod: "check",
      autoRenew: false,
      nextAnnualBillingDate: nextJuneFirstAfterSignup(new Date()),
      signedUpVia: "admin",
      notes: r.NOTE || "",
      notesHistory: contactNotes,
      lifetimeAnnualFeeWaived: lifetimeWaived,
      legacyProfile,
    });
    created++;

    if (batch.length >= BATCH) await flush();
  }
  await flush();

  console.log(`Members created: ${created}  updated: ${updated}  skipped: ${skipped}  email-collisions reassigned: ${emailCollisions}`);

  // -------------------------------------------------------------------------
  // Phase 7: Create Referral documents from legacyProfile.referredById
  // -------------------------------------------------------------------------
  console.log("\n--- Phase 7: Referral backfill ---");

  type LeanMember = { _id: mongoose.Types.ObjectId; memberNumber?: string; legacyProfile?: Record<string, unknown> };
  const allMembers = (await Member.find({ role: "member" })
    .select("_id memberNumber legacyProfile")
    .lean()) as unknown as LeanMember[];

  const byMemberNumber = new Map<string, string>();
  const byLegacyId = new Map<string, string>();
  for (const m of allMembers) {
    if (m.memberNumber) byMemberNumber.set(m.memberNumber.trim(), String(m._id));
    const lid = String((m.legacyProfile as Record<string, unknown> | undefined)?.legacyId || "").trim();
    if (lid) byLegacyId.set(lid, String(m._id));
  }

  const existingReferrals = await Referral.find({}).select("newMemberId").lean();
  const alreadyLinked = new Set(existingReferrals.map((r) => String(r.newMemberId)));

  let referralsCreated = 0;
  let referralsSkipped = 0;
  const perReferrer = new Map<string, number>();

  for (const m of allMembers) {
    const lp = (m.legacyProfile || {}) as Record<string, unknown>;
    const ref = String(lp.referredById || "").trim();
    if (!ref) continue;
    if (alreadyLinked.has(String(m._id))) { referralsSkipped++; continue; }
    const referrerId = byMemberNumber.get(ref) || byLegacyId.get(ref) ||
      byMemberNumber.get(`CT-${ref}`) || byMemberNumber.get(`RI-${ref}`);
    if (!referrerId || referrerId === String(m._id)) continue;
    const creditedAt = (() => {
      const s = String(lp.dateReferred || "").trim();
      if (!s) return undefined;
      const t = Date.parse(s);
      return Number.isNaN(t) ? undefined : new Date(t);
    })();
    if (apply) {
      try {
        await Referral.create({
          newMemberId: new mongoose.Types.ObjectId(String(m._id)),
          referrerMemberId: new mongoose.Types.ObjectId(referrerId),
          ...(creditedAt ? { creditedAt } : {}),
        });
        await Member.updateOne(
          { _id: m._id },
          { $set: { referredByMemberId: new mongoose.Types.ObjectId(referrerId) } }
        );
        referralsCreated++;
        perReferrer.set(referrerId, (perReferrer.get(referrerId) || 0) + 1);
      } catch {
        referralsSkipped++;
      }
    } else {
      referralsCreated++;
      perReferrer.set(referrerId, (perReferrer.get(referrerId) || 0) + 1);
    }
  }

  let refFloorApplied = 0;
  if (apply) {
    const LIFETIME_REFERRALS = 5;
    for (const referrerId of perReferrer.keys()) {
      const count = await Referral.countDocuments({ referrerMemberId: referrerId });
      await Member.updateOne(
        { _id: referrerId },
        { $set: { successfulReferralCount: count, lifetimeAnnualFeeWaived: count >= LIFETIME_REFERRALS } }
      );
    }

    // Apply REF# from employer field as a floor for successfulReferralCount.
    // Approach encodes referral count as "REF7" in the employer field when no
    // other employer data is stored. Use it where the backfill undercount.
    for (const m of allMembers) {
      const lp = (m.legacyProfile || {}) as Record<string, unknown>;
      const employer = String(lp.employer || "").trim();
      const refMatch = employer.match(/^REF(\d+)$/i);
      if (!refMatch) continue;
      const refCount = parseInt(refMatch[1], 10);
      if (!Number.isFinite(refCount) || refCount <= 0) continue;
      const memberId = String(m._id);
      const liveCount = await Referral.countDocuments({ referrerMemberId: memberId });
      if (liveCount >= refCount) continue; // already accurate or better
      await Member.updateOne(
        { _id: memberId },
        {
          $set: {
            successfulReferralCount: refCount,
            lifetimeAnnualFeeWaived: refCount >= LIFETIME_REFERRALS,
          },
        }
      );
      refFloorApplied++;
    }
  } else {
    // Dry-run: count how many REF# floors would be applied
    for (const m of allMembers) {
      const lp = (m.legacyProfile || {}) as Record<string, unknown>;
      const employer = String(lp.employer || "").trim();
      if (/^REF\d+$/i.test(employer)) refFloorApplied++;
    }
  }

  console.log(`Referral docs ${apply ? "created" : "would create"}: ${referralsCreated}  skipped (already linked): ${referralsSkipped}`);
  console.log(`REF# employer floors ${apply ? "applied" : "would apply"}: ${refFloorApplied}`);

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log("\n================ SUMMARY ================");
  console.log(`OilCompany records created:   ${cosCreated}`);
  console.log(`OilCompany records matched:   ${cosMatched}`);
  console.log(`Members created:              ${created}`);
  console.log(`Members updated:              ${updated}`);
  console.log(`Members skipped:              ${skipped}`);
  console.log(`Delivery rows indexed:        ${deliveries.length}`);
  console.log(`Payment rows indexed:         ${payments.length}`);
  console.log(`Program rows indexed:         ${programs.length}`);
  console.log(`Contact notes indexed:        ${contacts.length}`);
  console.log(`Referral docs created:        ${referralsCreated}`);
  console.log(`REF# employer floors applied: ${refFloorApplied}`);

  if (!apply) {
    console.log("\nDRY RUN complete — no changes written. Re-run with --apply to commit.");
  } else {
    console.log("\nAPPLY complete.");
  }
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
