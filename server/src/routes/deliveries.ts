import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { requireAuth, requireAdmin, type AuthedRequest } from "../middleware/auth.js";
import { Member } from "../models/Member.js";
import { OilCompany } from "../models/OilCompany.js";
import { logActivity } from "../services/activity.js";
import { nextJuneFirstAfterSignup } from "../utils/juneBilling.js";
import {
  accountKeys,
  buildRow,
  deliveryRowInputSchema,
  normalizeRows,
  normCompany,
  sortRowsDesc,
  type DeliveryRow,
} from "../utils/deliveryRows.js";

const router = Router();
router.use(requireAuth, requireAdmin);

/* ---------- helpers ---------- */

async function loadMemberOrFail(idRaw: unknown, res: any) {
  const id = typeof idRaw === "string" ? idRaw : Array.isArray(idRaw) ? String(idRaw[0] ?? "") : String(idRaw ?? "");
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ error: "Invalid member id" });
    return null;
  }
  const member = await Member.findById(id);
  if (!member || (member as any).role !== "member") {
    res.status(404).json({ error: "Member not found" });
    return null;
  }
  return member;
}

function readRows(member: any): DeliveryRow[] {
  const lp = (member.legacyProfile && typeof member.legacyProfile === "object" ? member.legacyProfile : {}) as Record<
    string,
    unknown
  >;
  return normalizeRows(lp.deliveryHistoryRows);
}

function writeRows(member: any, rows: DeliveryRow[]) {
  const lp = (member.legacyProfile && typeof member.legacyProfile === "object" ? member.legacyProfile : {}) as Record<
    string,
    unknown
  >;
  member.legacyProfile = { ...lp, deliveryHistoryRows: sortRowsDesc(rows) };
  member.markModified("legacyProfile");
}

/* ---------- per-member CRUD ---------- */

/** GET /api/admin/deliveries/members/:id  → list */
router.get("/members/:id", async (req, res) => {
  const member = await loadMemberOrFail(req.params.id, res);
  if (!member) return;
  const rows = sortRowsDesc(readRows(member));
  res.json({ rows });
});

/** POST /api/admin/deliveries/members/:id  → add one row */
router.post("/members/:id", async (req: AuthedRequest, res) => {
  const member = await loadMemberOrFail(req.params.id, res);
  if (!member) return;
  const parsed = deliveryRowInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const row = buildRow(parsed.data, { source: "manual" });
  const rows = readRows(member);
  rows.push(row);
  writeRows(member, rows);
  await member.save();
  await logActivity(
    member._id,
    "admin_delivery_row_added",
    { rowId: row._id, fuel: row.fuelType, date: row.dateDelivered, gallons: row.gallons, adminId: req.userId },
    new mongoose.Types.ObjectId(req.userId!)
  );
  res.status(201).json({ row, rows: sortRowsDesc(readRows(member)) });
});

/** PUT /api/admin/deliveries/members/:id/:rowId  → update one row */
router.put("/members/:id/:rowId", async (req: AuthedRequest, res) => {
  const member = await loadMemberOrFail(req.params.id, res);
  if (!member) return;
  const parsed = deliveryRowInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const rowId = String(req.params.rowId);
  const rows = readRows(member);
  const idx = rows.findIndex((r) => r._id === rowId);
  if (idx === -1) {
    res.status(404).json({ error: "Delivery row not found" });
    return;
  }
  const updated = buildRow({ ...parsed.data, _id: rows[idx]._id }, { source: rows[idx].source });
  rows[idx] = updated;
  writeRows(member, rows);
  await member.save();
  await logActivity(
    member._id,
    "admin_delivery_row_updated",
    { rowId: updated._id, adminId: req.userId },
    new mongoose.Types.ObjectId(req.userId!)
  );
  res.json({ row: updated, rows: sortRowsDesc(readRows(member)) });
});

/** DELETE /api/admin/deliveries/members/:id/:rowId */
router.delete("/members/:id/:rowId", async (req: AuthedRequest, res) => {
  const member = await loadMemberOrFail(req.params.id, res);
  if (!member) return;
  const rowId = String(req.params.rowId);
  const rows = readRows(member);
  const next = rows.filter((r) => r._id !== rowId);
  if (next.length === rows.length) {
    res.status(404).json({ error: "Delivery row not found" });
    return;
  }
  writeRows(member, next);
  await member.save();
  await logActivity(
    member._id,
    "admin_delivery_row_deleted",
    { rowId, adminId: req.userId },
    new mongoose.Types.ObjectId(req.userId!)
  );
  res.json({ ok: true, rows: sortRowsDesc(readRows(member)) });
});

/* ---------- bulk import ---------- */

const importRowSchema = z.object({
  rowNumber: z.number().int().positive().optional(),
  fuelType: z.string().min(1),
  account: z.string().min(1),
  companyName: z.string().min(1),
  dateDelivered: z.string().min(1),
  gallons: z.number().finite().nonnegative(),
  /** Customer name from the import file — display-only; matching uses ID + company. */
  name: z.string().optional(),
  /** Service address from the vendor sheet — display-only for resolving unmatched rows. */
  address: z.string().optional(),
});

const createMembersSchema = z.record(
  z.string(),
  z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
  })
);

const importPayloadSchema = z.object({
  fileName: z.string().optional().default(""),
  dryRun: z.boolean().optional().default(false),
  rows: z.array(importRowSchema).min(1).max(20000),
  /**
   * Per-apply confirmations from the import UI. Omitted/empty on dry-run.
   * - firstDeliveryMemberIds: members who currently have 0 delivery rows; only
   *   members listed here will have their rows applied (others are skipped so
   *   the admin can re-verify the match).
   * - createMembers: keyed by "FUEL|companyKey|accountKey" (the group key
   *   surfaced in the dry-run report's `unmatched` array). Each entry creates a
   *   new member with the given name and links the import account/company,
   *   then appends the delivery rows in that group.
   */
  confirmations: z
    .object({
      firstDeliveryMemberIds: z.array(z.string()).optional().default([]),
      createMembers: createMembersSchema.optional().default({}),
    })
    .optional()
    .default({ firstDeliveryMemberIds: [], createMembers: {} }),
});

type ImportRowError = {
  rowNumber: number;
  reason: string;
  detail?: Record<string, unknown>;
};

/** Explains why a row did not auto-match — helps staff fix IDs or company strings on the member. */
type UnmatchHint = {
  code: string;
  message: string;
  memberIds?: string[];
};

function memberOilCompanyKeys(
  lp: Record<string, unknown>,
  oilCompanyId: unknown,
  oilCompanyById: Map<string, string>
): string[] {
  const keys: string[] = [];
  if (lp.oilCompanyName) keys.push(normCompany(String(lp.oilCompanyName)));
  if (oilCompanyId) {
    const linked = oilCompanyById.get(String(oilCompanyId));
    if (linked) keys.push(linked);
  }
  return [...new Set(keys.filter(Boolean))];
}

/**
 * When account + file company do not hit the index, infer whether the account exists
 * under another fuel slot, another company string, or multiple members.
 */
function computeUnmatchedHint(
  fuel: "OIL" | "PROPANE",
  acctKeys: string[],
  fileCompanyKey: string,
  members: Array<{
    _id: unknown;
    firstName?: string;
    lastName?: string;
    oilCompanyId?: unknown;
    legacyProfile?: Record<string, unknown>;
  }>,
  oilCompanyById: Map<string, string>
): UnmatchHint | undefined {
  type Hit = { memberId: string; name: string; memberCompanies: string[] };
  const wrongFuel: Hit[] = [];
  const companyMismatch: Hit[] = [];

  for (const m of members) {
    const lp = (m.legacyProfile || {}) as Record<string, unknown>;
    const memberId = String(m._id);
    const name = `${m.firstName || ""} ${m.lastName || ""}`.trim() || memberId;
    const oilKeys = accountKeys(String(lp.oilId || ""));
    const propKeys = accountKeys(String(lp.propaneId || ""));
    const oilCoKeys = memberOilCompanyKeys(lp, m.oilCompanyId, oilCompanyById);
    const propCoKey = normCompany(String(lp.propaneCompanyName || ""));

    const acctHitOil = acctKeys.some((k) => oilKeys.includes(k));
    const acctHitProp = acctKeys.some((k) => propKeys.includes(k));

    if (fuel === "OIL") {
      if (acctHitProp && !acctHitOil) {
        wrongFuel.push({ memberId, name, memberCompanies: propCoKey ? [propCoKey] : [] });
        continue;
      }
      if (!acctHitOil) continue;
      const companyOk = oilCoKeys.some((c) => c === fileCompanyKey);
      if (companyOk) continue;
      companyMismatch.push({ memberId, name, memberCompanies: oilCoKeys });
    } else {
      if (acctHitOil && !acctHitProp) {
        wrongFuel.push({ memberId, name, memberCompanies: oilCoKeys });
        continue;
      }
      if (!acctHitProp) continue;
      const companyOk = propCoKey && propCoKey === fileCompanyKey;
      if (companyOk) continue;
      companyMismatch.push({ memberId, name, memberCompanies: propCoKey ? [propCoKey] : [] });
    }
  }

  if (wrongFuel.length === 1) {
    const h = wrongFuel[0];
    return {
      code: "account_wrong_fuel_slot",
      message:
        fuel === "OIL"
          ? `This account is on file as a propane ID for ${h.name}, not an oil ID. Check the fuel column or add the oil account on the member.`
          : `This account is on file as an oil ID for ${h.name}, not a propane ID. Check the fuel column or add the propane account on the member.`,
      memberIds: [h.memberId],
    };
  }
  if (wrongFuel.length > 1) {
    return {
      code: "account_wrong_fuel_slot_multi",
      message: `This account appears as the wrong fuel type on ${wrongFuel.length} members; fix member records or the import fuel column.`,
      memberIds: wrongFuel.map((h) => h.memberId),
    };
  }

  if (companyMismatch.length === 1) {
    const h = companyMismatch[0];
    const onFile = h.memberCompanies.length ? h.memberCompanies.join(" / ") : "(none on file)";
    return {
      code: "company_mismatch",
      message: `Account matches ${h.name}, but the file company does not match their ${fuel === "OIL" ? "oil" : "propane"} company on file (${onFile}). Align spelling with the vendor sheet or update the member.`,
      memberIds: [h.memberId],
    };
  }
  if (companyMismatch.length > 1) {
    return {
      code: "company_mismatch_multi",
      message: `${companyMismatch.length} members share this account with different company strings; resolve duplicates in member data.`,
      memberIds: companyMismatch.map((h) => h.memberId),
    };
  }

  return undefined;
}

function unmatchedGroupKey(fuel: "OIL" | "PROPANE", companyKey: string, accountKey: string): string {
  return `${fuel}|${companyKey}|${accountKey}`;
}

function splitName(raw: string): { firstName: string; lastName: string } {
  const s = String(raw || "").trim();
  if (!s) return { firstName: "", lastName: "" };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/**
 * POST /api/admin/deliveries/import
 * body: {
 *   rows: [{ rowNumber, fuelType, account, companyName, dateDelivered, gallons, name? }],
 *   dryRun?: bool,
 *   confirmations?: { firstDeliveryMemberIds: string[], createMembers: { [groupKey]: { firstName, lastName } } }
 * }
 *
 * Each row is matched to a member by:
 *   1. fuelType (OIL or PROPANE)
 *   2. account (oilId for OIL, propaneId for PROPANE)
 *   3. companyName (matched against legacyProfile.<oil|propane>CompanyName,
 *      and for OIL also the linked OilCompany.name)
 *
 * Optional `address` from the client is stored only in the import report for staff review.
 *
 * Matched rows whose target member has 0 prior delivery rows are surfaced
 * separately as "first-delivery" — admins must confirm those before apply.
 * Unmatched rows can be turned into new members per group via `createMembers`.
 * Unmatched responses include `hint` when the account exists under another
 * company or fuel slot. Ambiguous rows are never auto-imported on apply; they
 * are appended to `errors` as `ambiguous_not_imported`.
 *
 * Returns a per-row report. When dryRun is true, no member is mutated.
 */
router.post("/import", async (req: AuthedRequest, res) => {
  const parsed = importPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { rows: rawRows, dryRun, fileName, confirmations } = parsed.data;
  const confirmedFirstDelivery = new Set(confirmations.firstDeliveryMemberIds);
  const importBatchId = `imp_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  // Build lookup index: fuel|companyKey|accountKey -> [memberId]
  const oilCompanies = await OilCompany.find().lean();
  const oilCompanyById = new Map<string, string>();
  const oilCompanyIdByName = new Map<string, string>();
  for (const oc of oilCompanies) {
    const key = normCompany(oc.name);
    oilCompanyById.set(String(oc._id), key);
    if (key) oilCompanyIdByName.set(key, String(oc._id));
  }

  const members = await Member.find({ role: "member" })
    .select("_id memberNumber firstName lastName oilCompanyId legacyProfile")
    .lean();

  /** Count of existing delivery rows per memberId — used to detect first-delivery members. */
  const existingRowCountByMember = new Map<string, number>();
  for (const m of members) {
    const lp = (m.legacyProfile || {}) as Record<string, unknown>;
    existingRowCountByMember.set(String(m._id), normalizeRows(lp.deliveryHistoryRows).length);
  }

  type IndexValue = { memberId: string; memberNumber: string; name: string };
  const index = new Map<string, IndexValue[]>();
  const addToIndex = (key: string, value: IndexValue) => {
    const list = index.get(key);
    if (list) list.push(value);
    else index.set(key, [value]);
  };

  for (const m of members) {
    const lp = (m.legacyProfile || {}) as Record<string, unknown>;
    const memberId = String(m._id);
    const value: IndexValue = {
      memberId,
      memberNumber: String(m.memberNumber || ""),
      name: `${m.firstName || ""} ${m.lastName || ""}`.trim(),
    };

    const oilIdKeys = accountKeys(String(lp.oilId || ""));
    const propIdKeys = accountKeys(String(lp.propaneId || ""));

    const oilCompanyNames = new Set<string>();
    if (lp.oilCompanyName) oilCompanyNames.add(normCompany(String(lp.oilCompanyName)));
    if (m.oilCompanyId) {
      const linked = oilCompanyById.get(String(m.oilCompanyId));
      if (linked) oilCompanyNames.add(linked);
    }
    for (const oilKey of oilIdKeys) {
      for (const co of oilCompanyNames) {
        if (co) addToIndex(`OIL|${co}|${oilKey}`, value);
      }
    }

    const propCompany = normCompany(String(lp.propaneCompanyName || ""));
    if (propCompany) {
      for (const propKey of propIdKeys) addToIndex(`PROPANE|${propCompany}|${propKey}`, value);
    }
  }

  type MatchedRow = { memberId: string; row: DeliveryRow; rowNumber: number };
  const matched: MatchedRow[] = [];
  const errors: ImportRowError[] = [];
  type UnmatchedRow = {
    rowNumber: number;
    groupKey: string;
    companyName: string;
    account: string;
    fuelType: "OIL" | "PROPANE";
    name?: string;
    address?: string;
    hint?: UnmatchHint;
    row: DeliveryRow;
  };
  const unmatchedRows: UnmatchedRow[] = [];
  const ambiguous: Array<{
    rowNumber: number;
    companyName: string;
    account: string;
    candidateMemberIds: string[];
  }> = [];

  rawRows.forEach((r, i) => {
    const rowNumber = r.rowNumber ?? i + 1;
    const fuelRaw = String(r.fuelType || "").toUpperCase().trim();
    const fuel = fuelRaw === "PROPANE" || fuelRaw === "PROP" || fuelRaw === "P" ? "PROPANE" : fuelRaw === "OIL" || fuelRaw === "O" ? "OIL" : null;
    if (!fuel) {
      errors.push({ rowNumber, reason: "invalid_fuel_type", detail: { fuelType: r.fuelType } });
      return;
    }
    // Normalize date — accept YYYY-MM-DD, M/D/YYYY, and Excel-format "MM-DD-YYYY".
    const date = normalizeDateFreeForm(String(r.dateDelivered));
    if (!date) {
      errors.push({ rowNumber, reason: "invalid_date", detail: { dateDelivered: r.dateDelivered } });
      return;
    }
    const gallons = Number(r.gallons);
    if (!Number.isFinite(gallons) || gallons < 0) {
      errors.push({ rowNumber, reason: "invalid_gallons", detail: { gallons: r.gallons } });
      return;
    }
    const acctKeys = accountKeys(r.account);
    const companyKey = normCompany(r.companyName);
    if (acctKeys.length === 0) {
      errors.push({ rowNumber, reason: "missing_account" });
      return;
    }
    if (!companyKey) {
      errors.push({ rowNumber, reason: "missing_company" });
      return;
    }
    const seen = new Set<string>();
    const candidates: IndexValue[] = [];
    for (const k of acctKeys) {
      const list = index.get(`${fuel}|${companyKey}|${k}`);
      if (!list) continue;
      for (const v of list) {
        if (seen.has(v.memberId)) continue;
        seen.add(v.memberId);
        candidates.push(v);
      }
    }
    if (candidates.length === 0) {
      const primaryAcctKey = acctKeys[0] || "";
      const hint = computeUnmatchedHint(fuel, acctKeys, companyKey, members, oilCompanyById);
      unmatchedRows.push({
        rowNumber,
        groupKey: unmatchedGroupKey(fuel, companyKey, primaryAcctKey),
        companyName: r.companyName,
        account: r.account,
        fuelType: fuel,
        name: r.name?.trim() || undefined,
        address: r.address?.trim() || undefined,
        ...(hint ? { hint } : {}),
        row: buildRow(
          { dateDelivered: date, fuelType: fuel, gallons, importBatchId },
          { source: "import" }
        ),
      });
      return;
    }
    if (candidates.length > 1) {
      ambiguous.push({
        rowNumber,
        companyName: r.companyName,
        account: r.account,
        candidateMemberIds: candidates.map((c) => c.memberId),
      });
      return;
    }
    matched.push({
      memberId: candidates[0].memberId,
      rowNumber,
      row: buildRow(
        {
          dateDelivered: date,
          fuelType: fuel,
          gallons,
          importBatchId,
        },
        { source: "import" }
      ),
    });
  });

  // Group matched rows by member so we can split "first-delivery" out.
  const matchedByMember = new Map<string, MatchedRow[]>();
  for (const m of matched) {
    const list = matchedByMember.get(m.memberId);
    if (list) list.push(m);
    else matchedByMember.set(m.memberId, [m]);
  }

  type FirstDeliveryMember = {
    memberId: string;
    memberNumber: string;
    name: string;
    rowNumbers: number[];
    rowCount: number;
  };
  const firstDeliveryMembers: FirstDeliveryMember[] = [];
  for (const [memberId, items] of matchedByMember.entries()) {
    if ((existingRowCountByMember.get(memberId) ?? 0) > 0) continue;
    const m = members.find((mm) => String(mm._id) === memberId);
    firstDeliveryMembers.push({
      memberId,
      memberNumber: String(m?.memberNumber || ""),
      name: `${m?.firstName || ""} ${m?.lastName || ""}`.trim(),
      rowNumbers: items.map((it) => it.rowNumber).sort((a, b) => a - b),
      rowCount: items.length,
    });
  }

  // Group unmatched rows by groupKey so the UI can prompt once per (fuel+company+account).
  type UnmatchedGroup = {
    groupKey: string;
    fuelType: "OIL" | "PROPANE";
    companyName: string;
    account: string;
    rowCount: number;
    rowNumbers: number[];
    suggestedName: string;
    hint?: UnmatchHint;
  };
  const unmatchedGroupsMap = new Map<string, { rows: UnmatchedRow[]; suggestedName: string }>();
  for (const u of unmatchedRows) {
    const entry = unmatchedGroupsMap.get(u.groupKey);
    if (entry) {
      entry.rows.push(u);
      if (!entry.suggestedName && u.name) entry.suggestedName = u.name;
    } else {
      unmatchedGroupsMap.set(u.groupKey, { rows: [u], suggestedName: u.name || "" });
    }
  }
  const unmatchedGroups: UnmatchedGroup[] = [];
  for (const [groupKey, entry] of unmatchedGroupsMap.entries()) {
    const first = entry.rows[0];
    const hintFromRows = entry.rows.find((row) => row.hint)?.hint;
    unmatchedGroups.push({
      groupKey,
      fuelType: first.fuelType,
      companyName: first.companyName,
      account: first.account,
      rowCount: entry.rows.length,
      rowNumbers: entry.rows.map((r) => r.rowNumber).sort((a, b) => a - b),
      suggestedName: entry.suggestedName,
      ...(hintFromRows ? { hint: hintFromRows } : {}),
    });
  }

  // Flat unmatched array kept for backwards-compat / table view in the UI.
  const unmatched = unmatchedRows.map((u) => ({
    rowNumber: u.rowNumber,
    groupKey: u.groupKey,
    companyName: u.companyName,
    account: u.account,
    fuelType: u.fuelType,
    name: u.name,
    address: u.address,
    ...(u.hint ? { hint: u.hint } : {}),
  }));

  if (dryRun) {
    res.json({
      importBatchId,
      fileName,
      dryRun: true,
      summary: {
        totalRows: rawRows.length,
        matched: matched.length,
        firstDeliveryMembers: firstDeliveryMembers.length,
        unmatched: unmatched.length,
        unmatchedGroups: unmatchedGroups.length,
        ambiguous: ambiguous.length,
        invalid: errors.length,
      },
      matched: matched.map((m) => ({
        rowNumber: m.rowNumber,
        memberId: m.memberId,
        date: m.row.dateDelivered,
        fuelType: m.row.fuelType,
        gallons: m.row.gallons,
      })),
      firstDeliveryMembers,
      unmatched,
      unmatchedGroups,
      ambiguous,
      errors,
    });
    return;
  }

  // ---- Apply ----
  let appendedCount = 0;
  let skippedFirstDeliveryCount = 0;
  let createdMemberCount = 0;
  const createdMembers: Array<{ memberId: string; memberNumber: string; firstName: string; lastName: string }> = [];

  // 1) Matched rows — apply per member; skip first-delivery members not in the confirmed set.
  for (const [memberId, items] of matchedByMember.entries()) {
    if ((existingRowCountByMember.get(memberId) ?? 0) === 0 && !confirmedFirstDelivery.has(memberId)) {
      skippedFirstDeliveryCount += items.length;
      continue;
    }
    const member = await Member.findById(memberId);
    if (!member) continue;
    const existing = readRows(member);
    for (const it of items) {
      const dup = existing.some(
        (r) =>
          r.dateDelivered === it.row.dateDelivered &&
          r.fuelType === it.row.fuelType &&
          Math.abs(r.gallons - it.row.gallons) < 0.01
      );
      if (dup) {
        errors.push({
          rowNumber: it.rowNumber,
          reason: "duplicate_skipped",
          detail: { date: it.row.dateDelivered, fuelType: it.row.fuelType, gallons: it.row.gallons },
        });
        continue;
      }
      existing.push(it.row);
      appendedCount++;
    }
    writeRows(member, existing);
    await member.save();
  }

  // 2) Unmatched groups — create new members for the ones the admin opted in to.
  const unmatchedByGroup = new Map<string, UnmatchedRow[]>();
  for (const u of unmatchedRows) {
    const list = unmatchedByGroup.get(u.groupKey);
    if (list) list.push(u);
    else unmatchedByGroup.set(u.groupKey, [u]);
  }

  for (const [groupKey, decision] of Object.entries(confirmations.createMembers || {})) {
    const groupRows = unmatchedByGroup.get(groupKey);
    if (!groupRows || groupRows.length === 0) continue;
    const first = groupRows[0];
    const firstName = decision.firstName.trim();
    const lastName = decision.lastName.trim();
    if (!firstName || !lastName) continue;

    const companyKey = normCompany(first.companyName);
    const oilCompanyId =
      first.fuelType === "OIL" ? oilCompanyIdByName.get(companyKey) || null : null;
    const synthEmail = `import-${importBatchId}-${createdMembers.length}@oilcoop.local`;
    const passwordHash = await bcrypt.hash(`Imported-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`, 10);
    const memberNumber = await nextImportMemberNumber();
    const legacyProfile: Record<string, unknown> = {};
    if (first.fuelType === "OIL") {
      legacyProfile.oilId = first.account;
      legacyProfile.oilCompanyName = first.companyName;
    } else {
      legacyProfile.propaneId = first.account;
      legacyProfile.propaneCompanyName = first.companyName;
    }
    legacyProfile.deliveryHistoryRows = sortRowsDesc(groupRows.map((g) => g.row));

    const created = await Member.create({
      memberNumber,
      email: synthEmail,
      passwordHash,
      firstName,
      lastName,
      role: "member",
      status: "active",
      paymentMethod: "check",
      autoRenew: false,
      signedUpVia: "admin",
      nextAnnualBillingDate: nextJuneFirstAfterSignup(new Date()),
      ...(oilCompanyId ? { oilCompanyId: new mongoose.Types.ObjectId(oilCompanyId) } : {}),
      legacyProfile,
    });

    appendedCount += groupRows.length;
    createdMemberCount++;
    createdMembers.push({
      memberId: String(created._id),
      memberNumber,
      firstName,
      lastName,
    });
  }

  for (const a of ambiguous) {
    errors.push({
      rowNumber: a.rowNumber,
      reason: "ambiguous_not_imported",
      detail: {
        companyName: a.companyName,
        account: a.account,
        candidateMemberIds: a.candidateMemberIds,
      },
    });
  }

  await logActivity(
    new mongoose.Types.ObjectId(req.userId!),
    "admin_delivery_import",
    {
      importBatchId,
      fileName,
      totalRows: rawRows.length,
      matched: matched.length,
      appended: appendedCount,
      skippedFirstDelivery: skippedFirstDeliveryCount,
      createdMembers: createdMemberCount,
      unmatched: unmatched.length,
      ambiguous: ambiguous.length,
      invalid: errors.length,
      adminId: req.userId,
    },
    new mongoose.Types.ObjectId(req.userId!)
  );

  res.json({
    importBatchId,
    fileName,
    dryRun: false,
    summary: {
      totalRows: rawRows.length,
      matched: matched.length,
      appended: appendedCount,
      skippedFirstDelivery: skippedFirstDeliveryCount,
      createdMembers: createdMemberCount,
      firstDeliveryMembers: firstDeliveryMembers.length,
      unmatched: unmatched.length,
      unmatchedGroups: unmatchedGroups.length,
      ambiguous: ambiguous.length,
      invalid: errors.length,
    },
    firstDeliveryMembers,
    unmatched,
    unmatchedGroups,
    ambiguous,
    errors,
    createdMembers,
  });
});

/** Allocate the next `OC-NNNNNN` member number. Mirrors the helper in admin.ts. */
async function nextImportMemberNumber(): Promise<string> {
  const last = (await Member.findOne({ role: "member", memberNumber: { $regex: /^OC-\d+$/ } })
    .sort({ createdAt: -1 })
    .select("memberNumber")
    .lean()) as { memberNumber?: string } | null;
  const n = last?.memberNumber ? Number(last.memberNumber.replace("OC-", "")) : 1000;
  return `OC-${String((Number.isFinite(n) ? n : 1000) + 1).padStart(6, "0")}`;
}

function normalizeDateFreeForm(raw: string): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Excel sometimes serializes dates as `M/D/YYYY` or `M-D-YYYY` or with two-digit year.
  const slash = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (slash) {
    let [, m, d, y] = slash;
    let yi = Number(y);
    if (yi < 100) yi += 2000;
    const mi = Number(m);
    const di = Number(d);
    if (mi < 1 || mi > 12 || di < 1 || di > 31) return null;
    return `${String(yi).padStart(4, "0")}-${String(mi).padStart(2, "0")}-${String(di).padStart(2, "0")}`;
  }
  // Last resort: let Date parse it (handles ISO with time, etc).
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = parsed.getMonth() + 1;
    const d = parsed.getDate();
    if (y < 1900 || y > 2200) return null;
    return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return null;
}

/* ---------- cross-member search ---------- */

/**
 * GET /api/admin/deliveries/search
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD&year=YYYY&month=1..12
 *   &fuel=OIL|PROPANE&minGallons=0&maxGallons=999
 *   &companyName=...&account=...&memberId=...&q=...&limit=500
 *
 * Returns flattened delivery rows joined with member identity.
 */
router.get("/search", async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const limit = Math.max(1, Math.min(2000, Number(q.limit) || 500));
  const fuel = q.fuel ? String(q.fuel).toUpperCase() : "";
  const fuelType = fuel === "OIL" || fuel === "PROPANE" ? fuel : null;

  const yearNum = q.year ? Number(q.year) : null;
  const monthNum = q.month ? Number(q.month) : null;
  const minGallons = q.minGallons ? Number(q.minGallons) : null;
  const maxGallons = q.maxGallons ? Number(q.maxGallons) : null;
  const companyKey = normCompany(q.companyName || "");
  const queryAcctKeys = accountKeys(q.account || "");
  const text = (q.q || "").trim();

  // Pre-filter members at the DB level when we can (companyName / account).
  const memberFilter: Record<string, unknown> = { role: "member" };
  if (q.memberId && mongoose.isValidObjectId(q.memberId)) {
    memberFilter._id = new mongoose.Types.ObjectId(q.memberId);
  }
  if (text) {
    const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(escapeRx(text), "i");
    memberFilter.$or = [
      { firstName: rx },
      { lastName: rx },
      { memberNumber: rx },
      { email: rx },
      { "legacyProfile.legacyId": rx },
    ];
  }

  const members = await Member.find(memberFilter)
    .select("_id memberNumber firstName lastName oilCompanyId legacyProfile")
    .populate("oilCompanyId", "name")
    .lean();

  type Hit = {
    memberId: string;
    memberNumber: string;
    name: string;
    oilCompanyName: string;
    propaneCompanyName: string;
    oilId: string;
    propaneId: string;
    rowId: string;
    dateDelivered: string;
    fuelType: "OIL" | "PROPANE";
    gallons: number;
    source: string;
  };
  const hits: Hit[] = [];

  for (const m of members) {
    const lp = (m.legacyProfile || {}) as Record<string, unknown>;
    const memberOilCompanyName =
      String(lp.oilCompanyName || "") ||
      (m.oilCompanyId && typeof m.oilCompanyId === "object" && "name" in (m.oilCompanyId as any)
        ? String((m.oilCompanyId as any).name || "")
        : "");
    const memberPropCompanyName = String(lp.propaneCompanyName || "");

    if (companyKey) {
      const oc = normCompany(memberOilCompanyName);
      const pc = normCompany(memberPropCompanyName);
      if (oc !== companyKey && pc !== companyKey) continue;
    }
    if (queryAcctKeys.length > 0) {
      const memberKeys = new Set<string>([
        ...accountKeys(String(lp.oilId || "")),
        ...accountKeys(String(lp.propaneId || "")),
      ]);
      const hit = queryAcctKeys.some((k) => memberKeys.has(k));
      if (!hit) continue;
    }

    const rows = normalizeRows(lp.deliveryHistoryRows);
    for (const r of rows) {
      if (fuelType && r.fuelType !== fuelType) continue;
      if (yearNum && Number(r.dateDelivered.slice(0, 4)) !== yearNum) continue;
      if (monthNum && Number(r.dateDelivered.slice(5, 7)) !== monthNum) continue;
      if (q.from && r.dateDelivered < q.from) continue;
      if (q.to && r.dateDelivered > q.to) continue;
      if (minGallons !== null && r.gallons < minGallons) continue;
      if (maxGallons !== null && r.gallons > maxGallons) continue;
      hits.push({
        memberId: String(m._id),
        memberNumber: String(m.memberNumber || ""),
        name: `${m.firstName || ""} ${m.lastName || ""}`.trim(),
        oilCompanyName: memberOilCompanyName,
        propaneCompanyName: memberPropCompanyName,
        oilId: String(lp.oilId || ""),
        propaneId: String(lp.propaneId || ""),
        rowId: r._id,
        dateDelivered: r.dateDelivered,
        fuelType: r.fuelType,
        gallons: r.gallons,
        source: r.source,
      });
      if (hits.length >= limit) break;
    }
    if (hits.length >= limit) break;
  }

  hits.sort((a, b) => (a.dateDelivered < b.dateDelivered ? 1 : a.dateDelivered > b.dateDelivered ? -1 : 0));

  // Aggregate by member for a top-line summary panel.
  const perMember = new Map<string, { memberId: string; memberNumber: string; name: string; rows: number; gallons: number }>();
  for (const h of hits) {
    const cur = perMember.get(h.memberId);
    if (cur) {
      cur.rows += 1;
      cur.gallons += h.gallons;
    } else {
      perMember.set(h.memberId, {
        memberId: h.memberId,
        memberNumber: h.memberNumber,
        name: h.name,
        rows: 1,
        gallons: h.gallons,
      });
    }
  }

  res.json({
    summary: {
      totalRows: hits.length,
      totalMembers: perMember.size,
      totalGallons: hits.reduce((s, h) => s + h.gallons, 0),
      truncated: hits.length >= limit,
    },
    hits,
    byMember: [...perMember.values()].sort((a, b) => b.rows - a.rows || a.name.localeCompare(b.name)),
  });
});

export default router;
