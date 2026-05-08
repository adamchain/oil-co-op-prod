import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import crypto from "node:crypto";
import { requireAuth, requireAdmin, type AuthedRequest } from "../middleware/auth.js";
import { Member } from "../models/Member.js";
import { OilCompany } from "../models/OilCompany.js";
import { logActivity } from "../services/activity.js";
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
});

const importPayloadSchema = z.object({
  fileName: z.string().optional().default(""),
  dryRun: z.boolean().optional().default(false),
  rows: z.array(importRowSchema).min(1).max(20000),
});

type ImportRowError = {
  rowNumber: number;
  reason: string;
  detail?: Record<string, unknown>;
};

/**
 * POST /api/admin/deliveries/import
 * body: { rows: [{ rowNumber, fuelType, account, companyName, dateDelivered, gallons }], dryRun?: bool }
 *
 * Each row is matched to a member by:
 *   1. fuelType (OIL or PROPANE)
 *   2. account (oilId for OIL, propaneId for PROPANE)
 *   3. companyName (matched against legacyProfile.<oil|propane>CompanyName,
 *      and for OIL also the linked OilCompany.name)
 *
 * Returns a per-row report. When dryRun is true, no member is mutated.
 */
router.post("/import", async (req: AuthedRequest, res) => {
  const parsed = importPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { rows: rawRows, dryRun, fileName } = parsed.data;
  const importBatchId = `imp_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  // Build lookup index: fuel|companyKey|accountKey -> [memberId]
  const oilCompanies = await OilCompany.find().lean();
  const oilCompanyById = new Map<string, string>();
  for (const oc of oilCompanies) oilCompanyById.set(String(oc._id), normCompany(oc.name));

  const members = await Member.find({ role: "member" })
    .select("_id memberNumber firstName lastName oilCompanyId legacyProfile")
    .lean();

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
  const unmatched: Array<{ rowNumber: number; companyName: string; account: string; fuelType: string }> = [];
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
      unmatched.push({ rowNumber, companyName: r.companyName, account: r.account, fuelType: fuel });
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

  if (dryRun) {
    res.json({
      importBatchId,
      fileName,
      dryRun: true,
      summary: {
        totalRows: rawRows.length,
        matched: matched.length,
        unmatched: unmatched.length,
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
      unmatched,
      ambiguous,
      errors,
    });
    return;
  }

  // Group matched rows by member, append, save once per member.
  const byMember = new Map<string, MatchedRow[]>();
  for (const m of matched) {
    const list = byMember.get(m.memberId);
    if (list) list.push(m);
    else byMember.set(m.memberId, [m]);
  }

  let appendedCount = 0;
  for (const [memberId, items] of byMember.entries()) {
    const member = await Member.findById(memberId);
    if (!member) continue;
    const existing = readRows(member);
    // Dedupe: skip rows that exactly match (date+fuel+gallons) already on file.
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

  await logActivity(
    new mongoose.Types.ObjectId(req.userId!),
    "admin_delivery_import",
    {
      importBatchId,
      fileName,
      totalRows: rawRows.length,
      matched: matched.length,
      appended: appendedCount,
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
      unmatched: unmatched.length,
      ambiguous: ambiguous.length,
      invalid: errors.length,
    },
    unmatched,
    ambiguous,
    errors,
  });
});

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
