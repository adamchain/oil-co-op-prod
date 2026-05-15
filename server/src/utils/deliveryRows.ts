import crypto from "node:crypto";
import { z } from "zod";

/**
 * Canonical schema for one delivery row, persisted inside
 * `Member.legacyProfile.deliveryHistoryRows` (Mongoose Mixed array).
 *
 * Required from caller: dateDelivered (YYYY-MM-DD), fuelType, gallons.
 * Derived/auto-filled: _id, deliveryYear, source.
 *
 * `source` distinguishes manually-typed rows from importer rows so we can
 * later attribute / re-import without trampling manual entries.
 */
export const deliveryFuelSchema = z.enum(["OIL", "PROPANE"]);
export type DeliveryFuel = z.infer<typeof deliveryFuelSchema>;

export const deliveryRowInputSchema = z.object({
  _id: z.string().trim().min(1).optional(),
  dateDelivered: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateDelivered must be YYYY-MM-DD"),
  deliveryYear: z.number().int().optional(),
  fuelType: deliveryFuelSchema,
  gallons: z.number().finite().nonnegative(),
  source: z.enum(["manual", "import", "legacy"]).optional(),
  importBatchId: z.string().trim().optional(),
});

export type DeliveryRowInput = z.infer<typeof deliveryRowInputSchema>;

export type DeliveryRow = {
  _id: string;
  dateDelivered: string;
  deliveryYear: number;
  fuelType: DeliveryFuel;
  gallons: number;
  source: "manual" | "import" | "legacy";
  importBatchId?: string;
};

/**
 * Coerce whatever junk lives in `legacyProfile.deliveryHistoryRows` (legacy
 * docs may have stringified numbers, lowercase fuel values, missing _id) into
 * a clean DeliveryRow[]. Invalid rows are dropped silently — logging happens
 * at the call site if needed.
 */
export function normalizeRows(raw: unknown): DeliveryRow[] {
  if (!Array.isArray(raw)) return [];
  const out: DeliveryRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const dateDelivered = String(r.dateDelivered || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateDelivered)) continue;
    const fuelRaw = String(r.fuelType || "").toUpperCase();
    if (fuelRaw !== "OIL" && fuelRaw !== "PROPANE") continue;
    const gallons = Number(r.gallons);
    if (!Number.isFinite(gallons) || gallons < 0) continue;
    const yearFromDate = Number(dateDelivered.slice(0, 4));
    const deliveryYearRaw = Number(r.deliveryYear);
    const deliveryYear = Number.isFinite(deliveryYearRaw) ? deliveryYearRaw : yearFromDate;
    const sourceRaw = String(r.source || "");
    const source: DeliveryRow["source"] =
      sourceRaw === "manual" || sourceRaw === "import" || sourceRaw === "legacy"
        ? (sourceRaw as DeliveryRow["source"])
        : "legacy";
    const idRaw = typeof r._id === "string" && r._id.trim() ? r._id.trim() : crypto.randomUUID();
    const importBatchIdRaw =
      typeof r.importBatchId === "string" && r.importBatchId.trim() ? r.importBatchId.trim() : undefined;
    out.push({
      _id: idRaw,
      dateDelivered,
      deliveryYear,
      fuelType: fuelRaw as DeliveryFuel,
      gallons,
      source,
      ...(importBatchIdRaw ? { importBatchId: importBatchIdRaw } : {}),
    });
  }
  return out;
}

/** Sort newest first. Stable across equal dates by id for deterministic UI. */
export function sortRowsDesc(rows: DeliveryRow[]): DeliveryRow[] {
  return [...rows].sort((a, b) => {
    if (a.dateDelivered === b.dateDelivered) return a._id.localeCompare(b._id);
    return a.dateDelivered < b.dateDelivered ? 1 : -1;
  });
}

/**
 * Build the row from a validated input. `_id` is preserved if provided;
 * otherwise a fresh UUID is generated. `deliveryYear` defaults to year-of-date.
 */
export function buildRow(input: DeliveryRowInput, defaults?: { source?: DeliveryRow["source"] }): DeliveryRow {
  const yearFromDate = Number(input.dateDelivered.slice(0, 4));
  const id = input._id?.trim() || crypto.randomUUID();
  const source = input.source ?? defaults?.source ?? "manual";
  return {
    _id: id,
    dateDelivered: input.dateDelivered,
    deliveryYear: input.deliveryYear ?? yearFromDate,
    fuelType: input.fuelType,
    gallons: input.gallons,
    source,
    ...(input.importBatchId ? { importBatchId: input.importBatchId } : {}),
  };
}

/**
 * Stable normalization for company-name matching: lowercase, collapse whitespace,
 * drop lightweight punctuation so "Mirabito Energy, LLC" and "Mirabito Energy LLC"
 * align, and strip common legal suffixes from the end.
 */
export function normCompany(name: string | null | undefined): string {
  if (!name) return "";
  let s = String(name).trim().toLowerCase();
  s = s.replace(/&/g, " and ");
  s = s.replace(/['`]/g, "");
  s = s.replace(/[^a-z0-9\s]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  for (let i = 0; i < 4; i++) {
    const next = s
      .replace(/\b(incorporated|corporation|company)\b$/g, "")
      .replace(/\b(inc|llc|ltd|corp|co)\b$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

/** Trim, drop leading zeros that some legacy systems add, lowercase for case-insensitive match. */
export function normAccount(acct: string | null | undefined): string {
  if (!acct) return "";
  return String(acct).trim().toLowerCase().replace(/^0+(?=\d)/, "");
}

/**
 * Return all keys an account identifier should match under. Many oil/propane
 * vendors hand us a numeric customer #, but our member records store IDs like
 * "OIL-6609385". Indexing under both the canonical normalized form and a
 * digits-only form lets either side match.
 */
export function accountKeys(acct: string | null | undefined): string[] {
  const canonical = normAccount(acct);
  if (!canonical) return [];
  const digits = canonical.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (digits && digits !== canonical) return [canonical, digits];
  return [canonical];
}
