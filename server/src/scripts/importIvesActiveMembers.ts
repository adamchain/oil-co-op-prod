/**
 * Import the "IVES Active Members" roster + all Ives monthly delivery files into
 * the Member collection, and de-duplicate existing members.
 *
 * Sources (default under ~/Downloads; override with flags):
 *   --members  path      "IVES Active Members.XLS"  (ID,F_NAME_1,L_NAME_1,STREET_NO,
 *                        STREET_NM,CITY,STATE,ZIP,PHONE_1,OIL_CO,OIL_ID)
 *   --deliveries a b c   monthly files (Account|OIL ID, Name Last, Name First, GAL,
 *                        Month, Year, Product)
 *
 * Behaviour:
 *   1. For each roster member, gather ALL existing matches by NAME+ADDRESS *and* by
 *      OIL ACCOUNT, collapse them onto one "keeper" (richest record), merge blanks,
 *      delete the extras, and stamp the roster's canonical name/address/oilId.
 *   2. Safety de-dupe passes over survivors: exact same OIL ACCOUNT, then NAME+ADDRESS.
 *      (Same name with *different* oil accounts — e.g. 12313-1 / 12313-2 — is preserved.)
 *   3. Attach monthly delivery rows (matched by oil account) into
 *      legacyProfile.deliveryHistoryRows, skipping rows already present.
 *
 * Safety: DRY RUN by default. Pass --apply to write. Deleted members are dumped to a
 * JSON backup first for rollback.
 *
 * Run:
 *   cd server && MONGODB_URI='mongodb+srv://...' npx tsx src/scripts/importIvesActiveMembers.ts \
 *     --members "/Users/adamchain/Downloads/IVES Active Members.XLS" \
 *     --deliveries "/Users/adamchain/Downloads/Ives March 2026.xlsx" "/Users/adamchain/Downloads/IVES April 2026.xlsx" \
 *     [--apply]
 */
import crypto from "node:crypto";
import fs from "node:fs";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import * as XLSX from "xlsx";
import { connectDb } from "../db.js";
import { config } from "../config.js";
import { Member } from "../models/Member.js";
import { OilCompany } from "../models/OilCompany.js";
import { accountKeys, normalizeRows, sortRowsDesc, type DeliveryRow } from "../utils/deliveryRows.js";
import { nextJuneFirstAfterSignup } from "../utils/juneBilling.js";

const OIL_COMPANY_NAME = "Ives Brothers";
const BATCH_ID = "ives-monthly-import";
const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/* ------------------------------- CLI args ------------------------------- */
function argVal(flag: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] ?? "" : "";
}
function argList(flag: string): string[] {
  const i = process.argv.indexOf(flag);
  if (i < 0) return [];
  const out: string[] = [];
  for (let j = i + 1; j < process.argv.length && !process.argv[j].startsWith("--"); j++) out.push(process.argv[j]);
  return out;
}

/* ---------------------------- normalisation ----------------------------- */
function norm(s: unknown): string {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function nameAddrKey(m: { firstName?: unknown; lastName?: unknown; addressLine1?: unknown; city?: unknown; postalCode?: unknown }): string {
  return [norm(m.firstName), norm(m.lastName), norm(m.addressLine1), norm(m.city), norm(String(m.postalCode ?? "").slice(0, 5))].join("|");
}
function hasAddr(m: { addressLine1?: unknown }): boolean {
  return !!String(m.addressLine1 ?? "").trim();
}
function buildPhone(raw: string | undefined): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  if (digits.length === 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return digits;
}
function titleCase(s: string): string {
  return String(s).replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}

/* ----------------------------- parse members ---------------------------- */
type RosterMember = {
  legacyId: string; firstName: string; lastName: string; addressLine1: string;
  city: string; state: string; postalCode: string; phone: string; oilId: string;
};
function parseRoster(filePath: string): RosterMember[] {
  const wb = XLSX.read(fs.readFileSync(filePath), { type: "buffer" });
  const grid = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false });
  const out: RosterMember[] = [];
  for (const r of grid) {
    const firstName = String(r.F_NAME_1 ?? "").trim();
    const lastName = String(r.L_NAME_1 ?? "").trim();
    if (!firstName && !lastName) continue;
    out.push({
      legacyId: String(r.ID ?? "").trim(),
      firstName, lastName,
      addressLine1: [String(r.STREET_NO ?? "").trim(), String(r.STREET_NM ?? "").trim()].filter(Boolean).join(" "),
      city: String(r.CITY ?? "").trim(),
      state: String(r.STATE ?? "").trim() || "CT",
      postalCode: String(r.ZIP ?? "").trim(),
      phone: buildPhone(String(r.PHONE_1 ?? "")),
      oilId: String(r.OIL_ID ?? "").trim(),
    });
  }
  return out;
}

/* ---------------------------- parse deliveries -------------------------- */
type DeliveryRecord = {
  oilId: string; lastName: string; firstName: string; gallons: number;
  dateDelivered: string; year: number; fuelType: "OIL" | "PROPANE"; sourceFile: string;
};
function monthNum(month: unknown, year: unknown): { mm: string; yyyy: string } | null {
  const raw = String(month ?? "").trim().toLowerCase();
  let mm = "";
  const numMatch = raw.match(/^(\d{1,2})/);
  if (numMatch) mm = numMatch[1].padStart(2, "0");
  if (!mm || Number(mm) < 1 || Number(mm) > 12) mm = MONTHS[raw.replace(/[^a-z]/g, "").slice(0, 3)] || "";
  const yyyy = String(year ?? "").trim().match(/\d{4}/)?.[0] || "";
  if (!mm || Number(mm) < 1 || Number(mm) > 12 || !yyyy) return null;
  return { mm, yyyy };
}
function parseDeliveries(filePath: string): DeliveryRecord[] {
  const wb = XLSX.read(fs.readFileSync(filePath), { type: "buffer" });
  const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: false });
  if (!grid.length) return [];
  const header = (grid[0] as unknown[]).map((c) => String(c ?? "").trim().toLowerCase());
  const findCol = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const acctCol = findCol("account", "oil id", "oilid");
  const lastCol = findCol("name last", "last", "l_name_1");
  const firstCol = findCol("name first", "first", "f_name_1");
  const galCol = findCol("gal", "gallons");
  const monthCol = findCol("month");
  const yearCol = findCol("year");
  const prodCol = findCol("product", "fuel");
  if (acctCol < 0 || galCol < 0) throw new Error(`Unrecognized delivery header in ${filePath}: ${JSON.stringify(header)}`);
  const base = filePath.split("/").pop() || filePath;
  const out: DeliveryRecord[] = [];
  for (let i = 1; i < grid.length; i++) {
    const row = (grid[i] as unknown[]) || [];
    const oilId = String(row[acctCol] ?? "").trim();
    if (!oilId) continue;
    const gallons = Number(String(row[galCol] ?? "").replace(/,/g, ""));
    if (!Number.isFinite(gallons) || gallons <= 0) continue;
    const my = monthNum(row[monthCol], row[yearCol]);
    if (!my) continue;
    const fuel = String(row[prodCol] ?? "").trim().toUpperCase();
    out.push({
      oilId,
      lastName: String(lastCol >= 0 ? row[lastCol] ?? "" : "").trim(),
      firstName: String(firstCol >= 0 ? row[firstCol] ?? "" : "").trim(),
      gallons,
      dateDelivered: `${my.yyyy}-${my.mm}-01`,
      year: Number(my.yyyy),
      fuelType: fuel.startsWith("PROP") ? "PROPANE" : "OIL",
      sourceFile: base,
    });
  }
  return out;
}

/* ------------------------------ richness -------------------------------- */
function isSyntheticEmail(email: unknown): boolean {
  const e = String(email || "").toLowerCase();
  return !e || e.includes("@import.oilcoop.local") || e.includes("@oilcoop.local");
}
function richness(m: any): number {
  let s = 0;
  if (!isSyntheticEmail(m.email)) s += 10000;
  if (m.registrationFeePaidAt) s += 5000;
  if (m.authnetPaymentProfileId) s += 4000;
  if (m.stripeCustomerId) s += 3000;
  if (m.lastAnnualChargeAt) s += 2000;
  s += (Array.isArray(m.notesHistory) ? m.notesHistory.length : 0) * 50;
  s += normalizeRows(m?.legacyProfile?.deliveryHistoryRows).length * 20;
  for (const f of ["phone", "addressLine1", "city", "postalCode"]) if (String(m[f] || "").trim()) s += 5;
  if (String(m?.legacyProfile?.oilId || "").trim()) s += 5;
  return s;
}
function chooseKeeper(cands: any[]): any {
  return [...cands].sort((a, b) => {
    const rd = richness(b) - richness(a);
    if (rd !== 0) return rd;
    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
  })[0];
}

/* -------------------------------- main ---------------------------------- */
async function main() {
  const apply = process.argv.includes("--apply");
  const membersPath = argVal("--members") || "/Users/adamchain/Downloads/IVES Active Members.XLS";
  const deliveryPaths = argList("--deliveries");
  const backupPath = argVal("--backup") || `/Users/adamchain/Desktop/Oil-co-op-prod/docs/ives-import-backup.json`;

  const isRemote = !/127\.0\.0\.1|localhost/.test(config.mongoUri);
  console.log(`\nMongo target: ${isRemote ? "REMOTE (prod)" : "LOCAL"} — ${config.mongoUri.replace(/:\/\/[^@]*@/, "://***@")}`);
  console.log(`Mode: ${apply ? "APPLY (writes enabled)" : "DRY RUN (no writes)"}`);

  if (!fs.existsSync(membersPath)) throw new Error(`members file not found: ${membersPath}`);
  const roster = parseRoster(membersPath);
  console.log(`\nRoster: ${roster.length} members from ${membersPath.split("/").pop()}`);

  // Parse + de-dupe delivery rows across files.
  const seenDelivery = new Set<string>();
  const deliveries: DeliveryRecord[] = [];
  const perFile: Record<string, number> = {};
  for (const p of deliveryPaths) {
    if (!fs.existsSync(p)) throw new Error(`delivery file not found: ${p}`);
    const recs = parseDeliveries(p);
    perFile[p.split("/").pop() || p] = recs.length;
    for (const rec of recs) {
      const k = `${accountKeys(rec.oilId)[0] || rec.oilId}|${rec.dateDelivered}|${rec.gallons}|${rec.fuelType}`;
      if (seenDelivery.has(k)) continue;
      seenDelivery.add(k);
      deliveries.push(rec);
    }
  }
  console.log(`Delivery files: ${JSON.stringify(perFile)}`);
  console.log(`Delivery rows (deduped across files): ${deliveries.length}`);

  await connectDb();

  const oilCo = (await OilCompany.findOne({ name: OIL_COMPANY_NAME }).lean()) as { _id: mongoose.Types.ObjectId } | null;
  const oilCompanyId = oilCo?._id ?? null;
  console.log(`Oil company "${OIL_COMPANY_NAME}": ${oilCompanyId ? oilCompanyId : "NOT FOUND (leaving unlinked)"}`);

  const all: any[] = await Member.find({}).lean();
  const members = all.filter((m) => m.role === "member");
  console.log(`Existing members in DB: ${members.length}`);

  /* ------- indexes over existing docs ------- */
  const byNameAddr = new Map<string, any[]>();
  const byAccount = new Map<string, any>();
  for (const m of members) {
    if (hasAddr(m)) { const k = nameAddrKey(m); (byNameAddr.get(k) || byNameAddr.set(k, []).get(k)!).push(m); }
    for (const ak of accountKeys(String(m?.legacyProfile?.oilId || ""))) if (!byAccount.has(ak)) byAccount.set(ak, m);
  }

  const passwordHash = apply ? await bcrypt.hash(`Ives-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`, 10) : "";

  /* ------- mutation accumulators ------- */
  const updById = new Map<string, { doc: any; set: Record<string, unknown> }>();
  const setFor = (doc: any) => {
    const id = String(doc._id);
    if (!updById.has(id)) updById.set(id, { doc, set: {} });
    return updById.get(id)!.set;
  };
  const deletedIds = new Set<string>();
  const deleteBackup: any[] = [];
  const creates: any[] = [];
  const mergeInto = new Map<string, any>();        // deletedId -> keeper doc
  const workingByAccount = new Map<string, any>(); // accountKey -> live keeper doc
  for (const [ak, m] of byAccount) workingByAccount.set(ak, m);
  const mergePreview: string[] = [];

  const mergeBlanks = (keeper: any, set: Record<string, unknown>, donor: any) => {
    for (const f of ["phone", "addressLine1", "addressLine2", "city", "state", "postalCode"]) {
      if (!String(keeper[f] || "").trim() && !String(set[f] || "").trim() && String(donor[f] || "").trim()) set[f] = donor[f];
    }
    if (isSyntheticEmail(keeper.email) && set.email == null && !isSyntheticEmail(donor.email)) set.email = donor.email;
    if (!keeper.oilCompanyId && !set.oilCompanyId && donor.oilCompanyId) set.oilCompanyId = donor.oilCompanyId;
    if (!String(keeper?.legacyProfile?.oilId || "").trim() && !set["legacyProfile.oilId"] && String(donor?.legacyProfile?.oilId || "").trim())
      set["legacyProfile.oilId"] = donor.legacyProfile.oilId;
  };
  const deleteLoser = (keeper: any, loser: any, why: string) => {
    deletedIds.add(String(loser._id));
    deleteBackup.push(loser);
    mergeInto.set(String(loser._id), keeper);
    for (const ak of accountKeys(String(loser?.legacyProfile?.oilId || ""))) workingByAccount.set(ak, keeper);
    if (mergePreview.length < 40)
      mergePreview.push(`  • ${titleCase(String(keeper.firstName))} ${titleCase(String(keeper.lastName))} — keep ${keeper.memberNumber || keeper._id}, delete ${loser.memberNumber || loser._id} [${why}]`);
  };

  /* ------- Phase 1: roster upsert with candidate collapse ------- */
  let createdMembers = 0, matchedRows = 0;
  for (const r of roster) {
    const cands = new Map<string, any>();
    if (r.addressLine1.trim()) for (const m of byNameAddr.get(nameAddrKey(r)) || []) if (!deletedIds.has(String(m._id))) cands.set(String(m._id), m);
    for (const ak of accountKeys(r.oilId)) { const m = byAccount.get(ak); if (m && !deletedIds.has(String(m._id))) cands.set(String(m._id), m); }
    const list = [...cands.values()];

    if (list.length === 0) {
      const memberNumber = `IVES-${r.legacyId || crypto.randomBytes(3).toString("hex")}`;
      const slug = norm(`${r.firstName} ${r.lastName}`).replace(/\s+/g, ".") || "member";
      const doc: any = {
        _id: new mongoose.Types.ObjectId(),
        memberNumber,
        email: `ives-${(r.oilId || r.legacyId || memberNumber).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${slug}@import.oilcoop.local`,
        passwordHash,
        firstName: r.firstName || "Unknown",
        lastName: r.lastName || r.legacyId || "Member",
        phone: r.phone, addressLine1: r.addressLine1, city: r.city, state: r.state, postalCode: r.postalCode,
        role: "member", status: "active", oilCompanyId,
        paymentMethod: "check", autoRenew: false,
        nextAnnualBillingDate: nextJuneFirstAfterSignup(new Date()),
        signedUpVia: "admin",
        legacyProfile: {
          oilId: r.oilId, legacyId: r.legacyId, oilCompanyName: OIL_COMPANY_NAME,
          workbenchMemberStatus: "ACTIVE", importSource: "ives-active-members", deliveryHistoryRows: [],
        },
      };
      creates.push(doc);
      createdMembers++;
      if (hasAddr(doc)) (byNameAddr.get(nameAddrKey(doc)) || byNameAddr.set(nameAddrKey(doc), []).get(nameAddrKey(doc))!).push(doc);
      for (const ak of accountKeys(r.oilId)) { if (!byAccount.has(ak)) byAccount.set(ak, doc); workingByAccount.set(ak, doc); }
      continue;
    }

    const keeper = chooseKeeper(list);
    const set = setFor(keeper);
    for (const loser of list) if (String(loser._id) !== String(keeper._id)) { mergeBlanks(keeper, set, loser); deleteLoser(keeper, loser, "roster match"); }
    // Stamp roster canonical data (fill address/phone only if keeper lacks it).
    set.firstName = r.firstName || keeper.firstName;
    set.lastName = r.lastName || keeper.lastName;
    set["legacyProfile.oilId"] = r.oilId || String(keeper?.legacyProfile?.oilId || "") || (set["legacyProfile.oilId"] as string) || "";
    set["legacyProfile.legacyId"] = r.legacyId || String(keeper?.legacyProfile?.legacyId || "");
    set["legacyProfile.oilCompanyName"] = OIL_COMPANY_NAME;
    set["legacyProfile.importSource"] = "ives-active-members";
    set["legacyProfile.workbenchMemberStatus"] = "ACTIVE";
    if (!String(keeper.addressLine1 || "").trim() && !set.addressLine1 && r.addressLine1) set.addressLine1 = r.addressLine1;
    if (!String(keeper.city || "").trim() && !set.city && r.city) set.city = r.city;
    if (!String(keeper.state || "").trim() && !set.state && r.state) set.state = r.state;
    if (!String(keeper.postalCode || "").trim() && !set.postalCode && r.postalCode) set.postalCode = r.postalCode;
    if (!String(keeper.phone || "").trim() && !set.phone && r.phone) set.phone = r.phone;
    if (oilCompanyId && !keeper.oilCompanyId && !set.oilCompanyId) set.oilCompanyId = oilCompanyId;
    for (const ak of accountKeys(r.oilId)) workingByAccount.set(ak, keeper);
    matchedRows++;
  }

  /* ------- Phase 2: safety de-dupe over survivors ------- */
  const survivors = () => [...members, ...creates].filter((m) => !deletedIds.has(String(m._id)));
  const effectiveOilId = (m: any) => String((updById.get(String(m._id))?.set["legacyProfile.oilId"] as string) ?? m?.legacyProfile?.oilId ?? "").trim();
  const effectiveNameAddr = (m: any) => {
    const s = updById.get(String(m._id))?.set || {};
    return nameAddrKey({
      firstName: s.firstName ?? m.firstName, lastName: s.lastName ?? m.lastName,
      addressLine1: s.addressLine1 ?? m.addressLine1, city: s.city ?? m.city, postalCode: s.postalCode ?? m.postalCode,
    });
  };
  const collapse = (groups: Map<string, any[]>, why: string) => {
    for (const grp of groups.values()) {
      if (grp.length < 2) continue;
      const keeper = chooseKeeper(grp);
      const set = setFor(keeper);
      for (const loser of grp) if (String(loser._id) !== String(keeper._id) && !deletedIds.has(String(loser._id))) { mergeBlanks(keeper, set, loser); deleteLoser(keeper, loser, why); }
    }
  };
  // 2a. exact same oil account
  const g1 = new Map<string, any[]>();
  for (const m of survivors()) { const o = accountKeys(effectiveOilId(m))[0]; if (!o) continue; (g1.get(o) || g1.set(o, []).get(o)!).push(m); }
  collapse(g1, "same oil account");
  // 2b. exact same name+address (requires address)
  const g2 = new Map<string, any[]>();
  for (const m of survivors()) { if (!hasAddr({ addressLine1: (updById.get(String(m._id))?.set.addressLine1 ?? m.addressLine1) })) continue; const k = effectiveNameAddr(m); (g2.get(k) || g2.set(k, []).get(k)!).push(m); }
  collapse(g2, "same name+address");

  // Drop any creates that got merged away (shouldn't normally happen).
  const liveCreates = creates.filter((c) => !deletedIds.has(String(c._id)));

  /* ------- Phase 3: attach delivery rows by oil account ------- */
  const rowsByMemberId = new Map<string, { doc: any; rows: DeliveryRow[]; added: number }>();
  const unmatched: DeliveryRecord[] = [];
  for (const d of deliveries) {
    let target: any;
    for (const ak of accountKeys(d.oilId)) if (workingByAccount.has(ak)) { target = workingByAccount.get(ak); break; }
    if (!target) { unmatched.push(d); continue; }
    while (mergeInto.has(String(target._id))) target = mergeInto.get(String(target._id));
    const key = String(target._id);
    if (!rowsByMemberId.has(key)) rowsByMemberId.set(key, { doc: target, rows: normalizeRows(target?.legacyProfile?.deliveryHistoryRows), added: 0 });
    const bucket = rowsByMemberId.get(key)!;
    if (bucket.rows.some((x) => x.dateDelivered === d.dateDelivered && x.fuelType === d.fuelType && Math.abs(x.gallons - d.gallons) < 0.001)) continue;
    bucket.rows.push({ _id: crypto.randomUUID(), dateDelivered: d.dateDelivered, deliveryYear: d.year, fuelType: d.fuelType, gallons: d.gallons, source: "import", importBatchId: BATCH_ID });
    bucket.added++;
  }
  const deliveryRowsToAttach = [...rowsByMemberId.values()].reduce((n, b) => n + b.added, 0);

  // Stub members for unmatched delivery accounts.
  const unmatchedByAcct = new Map<string, DeliveryRecord[]>();
  for (const d of unmatched) { const ak = accountKeys(d.oilId)[0] || d.oilId; (unmatchedByAcct.get(ak) || unmatchedByAcct.set(ak, []).get(ak)!).push(d); }
  let stubCreated = 0, stubRows = 0;
  for (const [, recs] of unmatchedByAcct) {
    const first = recs[0];
    const rows: DeliveryRow[] = [];
    for (const d of recs) {
      if (rows.some((x) => x.dateDelivered === d.dateDelivered && x.fuelType === d.fuelType && Math.abs(x.gallons - d.gallons) < 0.001)) continue;
      rows.push({ _id: crypto.randomUUID(), dateDelivered: d.dateDelivered, deliveryYear: d.year, fuelType: d.fuelType, gallons: d.gallons, source: "import", importBatchId: BATCH_ID });
    }
    stubRows += rows.length;
    creates.push({
      _id: new mongoose.Types.ObjectId(),
      memberNumber: `IVES-ACCT-${(first.oilId || crypto.randomBytes(3).toString("hex")).replace(/[^A-Za-z0-9]+/g, "")}`,
      email: `ives-${(first.oilId || "acct").toLowerCase().replace(/[^a-z0-9]+/g, "-")}@import.oilcoop.local`,
      passwordHash,
      firstName: first.firstName || "—", lastName: first.lastName || first.oilId || "—",
      role: "member", status: "active", oilCompanyId,
      paymentMethod: "check", autoRenew: false,
      nextAnnualBillingDate: nextJuneFirstAfterSignup(new Date()), signedUpVia: "admin",
      legacyProfile: { oilId: first.oilId, oilCompanyName: OIL_COMPANY_NAME, workbenchMemberStatus: "ACTIVE", importSource: "ives-monthly-delivery", deliveryHistoryRows: sortRowsDesc(rows) },
    });
    stubCreated++;
  }
  liveCreates.push(...creates.slice(creates.length - stubCreated));

  /* ------------------------------ report ------------------------------- */
  const updateCount = [...updById.values()].filter((u) => Object.keys(u.set).length && !deletedIds.has(String(u.doc._id))).length;
  console.log(`\n================ PLAN ================`);
  console.log(`Members to CREATE (roster):       ${createdMembers}`);
  console.log(`Members to UPDATE (matched):      ${updateCount}`);
  console.log(`Members to DELETE (dupes merged): ${deletedIds.size}`);
  console.log(`Delivery rows to attach:          ${deliveryRowsToAttach}`);
  console.log(`Unmatched delivery accounts:      ${unmatchedByAcct.size} (stub members: ${stubCreated}, rows: ${stubRows})`);
  if (mergePreview.length) { console.log(`\nDuplicate merges (first ${mergePreview.length}):`); console.log(mergePreview.join("\n")); }
  if (unmatchedByAcct.size) console.log(`\nUnmatched delivery accounts (first 20): ${[...unmatchedByAcct.keys()].slice(0, 20).join(", ")}`);

  if (!apply) {
    console.log(`\nDRY RUN complete — no changes written. Re-run with --apply to commit.`);
    await mongoose.disconnect();
    return;
  }

  /* ------------------------------- apply ------------------------------- */
  fs.writeFileSync(backupPath, JSON.stringify({ when: new Date().toISOString(), mongo: config.mongoUri.replace(/:\/\/[^@]*@/, "://***@"), deleted: deleteBackup }, null, 2));
  console.log(`\nBackup of ${deleteBackup.length} to-be-deleted members → ${backupPath}`);

  if (deletedIds.size) {
    const res = await Member.deleteMany({ _id: { $in: [...deletedIds].map((id) => new mongoose.Types.ObjectId(id)) } });
    console.log(`Deleted ${res.deletedCount} duplicate members.`);
  }
  // route delivery rows: existing keepers -> update set; new creates -> mutate doc
  const createIds = new Set(creates.map((c) => String(c._id)));
  for (const [id, bucket] of rowsByMemberId) {
    if (deletedIds.has(id)) continue;
    if (createIds.has(id)) { bucket.doc.legacyProfile.deliveryHistoryRows = sortRowsDesc(bucket.rows); continue; }
    setFor(bucket.doc)["legacyProfile.deliveryHistoryRows"] = sortRowsDesc(bucket.rows);
  }
  let upCount = 0;
  for (const { doc, set } of updById.values()) {
    if (deletedIds.has(String(doc._id)) || !Object.keys(set).length) continue;
    await Member.updateOne({ _id: doc._id }, { $set: set });
    upCount++;
  }
  console.log(`Applied ${upCount} member updates.`);
  const toInsert = creates.filter((c) => !deletedIds.has(String(c._id)));
  if (toInsert.length) {
    for (const c of toInsert) c.legacyProfile.deliveryHistoryRows = sortRowsDesc(normalizeRows(c.legacyProfile.deliveryHistoryRows));
    await Member.insertMany(toInsert, { ordered: false });
    console.log(`Created ${toInsert.length} members.`);
  }
  console.log(`\nAPPLY complete.`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
