import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../api";
import { useAuth } from "../authContext";

type OilCompany = { _id: string; name: string };
const CUSTOM_COMPANY = "__custom__";

/**
 * Import delivery summaries from Excel/CSV. The **first six columns (A–F)** are
 * always read in fixed order; any extra columns (G onward) are ignored.
 *   1) Product (OIL or PROP)  2) OIL ID / PROP ID  3) GAL  4) Month  5) Year  6) Name (reference only)
 * Row 1 is headers; data starts row 2. Name is not used for matching.
 * Default company (whole file) is required when there is no company column.
 * Validate → dry-run; Apply → append rows (deduped by date+fuel+gallons).
 */

type SemanticField =
  | "fuelType"
  | "account"
  | "companyName"
  | "dateDelivered"
  | "month"
  | "year"
  | "gallons"
  | "ignore";

/**
 * Standard co-op delivery spreadsheet: 6 columns A–F in order —
 * Product, OIL ID / PROP ID, GAL, Month, Year, Name (reference; not used for matching).
 */
const STANDARD_SIX_FIELDS: SemanticField[] = [
  "fuelType",
  "account",
  "gallons",
  "month",
  "year",
  "ignore",
];

/** Stable keys for the six required columns (positional A–F). */
const IMPORT_COL_KEYS = ["__c0", "__c1", "__c2", "__c3", "__c4", "__c5"] as const;

type ParsedSheet = {
  /** Header text from row 1, columns A–F (for display). */
  headers: string[];
  /** Data rows; each record uses IMPORT_COL_KEYS only. */
  rows: Array<Record<string, unknown>>;
};

/** Fixed mapping: column index → semantic field (never user-edited). */
const STRICT_SIX_MAPPING: Record<string, SemanticField> = Object.fromEntries(
  IMPORT_COL_KEYS.map((k, i) => [k, STANDARD_SIX_FIELDS[i]])
) as Record<string, SemanticField>;

/** Highest 1-based column index ≤ n that has a non-empty cell in columns 0..n-1 (only A–F when n=6). */
function maxUsedColumnIndexFirstN(grid: unknown[][], n: number): number {
  let max = 0;
  for (const row of grid) {
    if (!Array.isArray(row)) continue;
    const limit = Math.min(n, row.length);
    for (let i = 0; i < limit; i++) {
      if (String(row[i] ?? "").trim() !== "") max = Math.max(max, i + 1);
    }
  }
  return max;
}

type ServerImportResponse = {
  importBatchId: string;
  fileName: string;
  dryRun: boolean;
  summary: {
    totalRows: number;
    matched: number;
    appended?: number;
    unmatched: number;
    ambiguous: number;
    invalid: number;
  };
  matched?: Array<{
    rowNumber: number;
    memberId: string;
    date: string;
    fuelType: string;
    gallons: number;
  }>;
  unmatched: Array<{ rowNumber: number; companyName: string; account: string; fuelType: string }>;
  ambiguous: Array<{
    rowNumber: number;
    companyName: string;
    account: string;
    candidateMemberIds: string[];
  }>;
  errors: Array<{
    rowNumber: number;
    reason: string;
    detail?: Record<string, unknown>;
  }>;
};

const FIELD_LABELS: Record<SemanticField, string> = {
  fuelType: "Fuel type (OIL / PROP / PROPANE)",
  account: "Account # (oil ID or propane ID)",
  companyName: "Company name",
  dateDelivered: "Date delivered (full date)",
  month: "Month (1–12 or name; pair with Year)",
  year: "Year (YYYY; pair with Month)",
  gallons: "Gallons (GAL)",
  ignore: "Ignore (e.g. Name — reference only)",
};

const SIX_COLUMN_GUIDE = [
  "Product (OIL or PROP)",
  "OIL ID / PROP ID",
  "GAL",
  "Month (e.g. MARCH)",
  "Year",
  "Name (reference only — not matched)",
] as const;

const MONTH_NAMES_TO_NUM: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/**
 * Accepts "11-NOVEMBER", "NOVEMBER", "Nov", "11", "11/2025", etc.
 * Returns 1..12 or null if it can't be parsed.
 */
function parseMonthCell(raw: string): number | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  // Leading numeric prefix wins ("11-NOVEMBER" → 11).
  const numLead = s.match(/^\d{1,2}/);
  if (numLead) {
    const n = Number(numLead[0]);
    if (n >= 1 && n <= 12) return n;
  }
  // Otherwise try the first alphabetic chunk as a name.
  const nameMatch = s.match(/[A-Za-z]+/);
  if (nameMatch) {
    const key = nameMatch[0].toLowerCase();
    if (MONTH_NAMES_TO_NUM[key]) return MONTH_NAMES_TO_NUM[key];
  }
  return null;
}

function parseYearCell(raw: string): number | null {
  const s = String(raw || "").trim();
  const m = s.match(/\d{2,4}/);
  if (!m) return null;
  let n = Number(m[0]);
  if (n < 100) n += 2000;
  if (n < 1900 || n > 2200) return null;
  return n;
}

export default function AdminDeliveryImportPage() {
  const { token } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  // companySelection: "" (none), an OilCompany _id, or CUSTOM_COMPANY
  const [defaults, setDefaults] = useState({
    fuelType: "" as "" | "OIL" | "PROP" | "PROPANE",
    companySelection: "",
    customCompanyName: "",
  });
  const [oilCompanies, setOilCompanies] = useState<OilCompany[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ServerImportResponse | null>(null);
  const [reportMode, setReportMode] = useState<"validate" | "apply" | null>(null);

  useEffect(() => {
    if (!token) return;
    api<{ oilCompanies: OilCompany[] }>("/api/admin/oil-companies", { token })
      .then((r) => setOilCompanies([...r.oilCompanies].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setOilCompanies([]));
  }, [token]);

  // Resolve the actual company-name string to send for each row from the
  // current dropdown selection (an OilCompany _id) or the custom text.
  const resolvedDefaultCompanyName = useMemo(() => {
    if (defaults.companySelection === CUSTOM_COMPANY) return defaults.customCompanyName.trim();
    if (!defaults.companySelection) return "";
    const oc = oilCompanies.find((c) => c._id === defaults.companySelection);
    return oc?.name || "";
  }, [defaults.companySelection, defaults.customCompanyName, oilCompanies]);

  function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setReport(null);
    setReportMode(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) throw new Error("empty file");
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const wsName = wb.SheetNames[0];
        if (!wsName) throw new Error("no sheets in workbook");
        const ws = wb.Sheets[wsName];
        const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: false });
        if (!grid || grid.length === 0) {
          setSheet({ headers: [], rows: [] });
          return;
        }

        const usedInAF = maxUsedColumnIndexFirstN(grid, 6);
        if (usedInAF < 1) {
          setParseError(
            "No data found in columns A–F. Put the six required fields in the first columns: (1) Product, (2) OIL ID / PROP ID, (3) GAL, (4) Month, (5) Year, (6) Name. Extra columns past F are ignored."
          );
          setSheet(null);
          return;
        }

        const row0 = [...(grid[0] ?? [])];
        while (row0.length < 6) row0.push("");
        const headers = row0.slice(0, 6).map((c, i) => {
          const t = String(c ?? "").trim();
          return t || SIX_COLUMN_GUIDE[i];
        });

        const rows: Array<Record<string, unknown>> = [];
        for (let r = 1; r < grid.length; r++) {
          const cells = [...(grid[r] ?? [])];
          while (cells.length < 6) cells.push("");
          const o: Record<string, unknown> = {};
          for (let i = 0; i < 6; i++) o[IMPORT_COL_KEYS[i]] = cells[i] ?? "";
          rows.push(o);
        }

        setSheet({ headers, rows });
      } catch (err) {
        setParseError(err instanceof Error ? err.message : "Failed to parse file");
        setSheet(null);
      }
    };
    reader.onerror = () => setParseError("Could not read file");
    reader.readAsArrayBuffer(file);
  }

  const builtRows = useMemo(() => {
    if (!sheet)
      return {
        rows: [] as Array<{
          rowNumber: number;
          fuelType: string;
          account: string;
          companyName: string;
          dateDelivered: string;
          gallons: number;
        }>,
        missingFields: [] as string[],
        dateMode: "none" as "date" | "monthYear" | "none",
      };

    const colByField = (field: SemanticField) =>
      Object.entries(STRICT_SIX_MAPPING).find(([, f]) => f === field)?.[0] ?? null;
    const cols = {
      fuelType: colByField("fuelType"),
      account: colByField("account"),
      companyName: colByField("companyName"),
      dateDelivered: colByField("dateDelivered"),
      month: colByField("month"),
      year: colByField("year"),
      gallons: colByField("gallons"),
    };

    // Date strategy: prefer a full "Date delivered" column. If absent, accept
    // a paired Month + Year (synthesize first-of-month).
    const dateMode: "date" | "monthYear" | "none" = cols.dateDelivered
      ? "date"
      : cols.month && cols.year
      ? "monthYear"
      : "none";

    const missingFields: string[] = [];
    if (!cols.account) missingFields.push("account");
    if (dateMode === "none") missingFields.push("dateDelivered (or Month + Year)");
    if (!cols.gallons) missingFields.push("gallons");
    if (!cols.fuelType && !defaults.fuelType) missingFields.push("fuelType");
    if (!cols.companyName && !resolvedDefaultCompanyName) missingFields.push("companyName");

    const rows = sheet.rows.map((r, i) => {
      const cell = (col: string | null) => (col ? String(r[col] ?? "").trim() : "");
      let dateDelivered = "";
      if (dateMode === "date") {
        dateDelivered = cell(cols.dateDelivered);
      } else if (dateMode === "monthYear") {
        const m = parseMonthCell(cell(cols.month));
        const y = parseYearCell(cell(cols.year));
        if (m && y) {
          dateDelivered = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-01`;
        }
      }
      const gallonsRaw = cell(cols.gallons);
      return {
        rowNumber: i + 2, // header row is row 1 in spreadsheets
        fuelType: cell(cols.fuelType) || defaults.fuelType,
        account: cell(cols.account),
        companyName: cell(cols.companyName) || resolvedDefaultCompanyName,
        dateDelivered,
        gallons: Number(String(gallonsRaw).replace(/[^\d.\-]/g, "")) || 0,
      };
    });
    return { rows, missingFields, dateMode };
  }, [sheet, defaults, resolvedDefaultCompanyName]);

  async function postImport(dryRun: boolean) {
    if (!token || builtRows.rows.length === 0) return;
    setBusy(true);
    try {
      const r = await api<ServerImportResponse>(`/api/admin/deliveries/import`, {
        method: "POST",
        token,
        body: JSON.stringify({
          fileName,
          dryRun,
          rows: builtRows.rows,
        }),
      });
      setReport(r);
      setReportMode(dryRun ? "validate" : "apply");
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFileName("");
    setSheet(null);
    setReport(null);
    setReportMode(null);
    setParseError(null);
    setDefaults({ fuelType: "", companySelection: "", customCompanyName: "" });
    if (inputRef.current) inputRef.current.value = "";
  }

  const previewRows = sheet?.rows.slice(0, 8) ?? [];
  const canRun = sheet && sheet.rows.length > 0 && builtRows.missingFields.length === 0;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 600 }}>Delivery summaries — Import</h1>
        {sheet && (
          <button type="button" className="admin-btn" onClick={reset}>
            Reset
          </button>
        )}
      </div>
      <p style={{ color: "var(--admin-muted)", fontSize: "0.875rem", margin: "0.25rem 0 1.25rem" }}>
        The <strong>first six columns (A–F)</strong> are always used, in order (row 1 = headers, row 2+ = data):{" "}
        <strong>Product</strong> (OIL or PROP), <strong>OIL ID / PROP ID</strong>, <strong>GAL</strong>,{" "}
        <strong>Month</strong>, <strong>Year</strong>, <strong>Name</strong> (reference only; not used for matching).
        Additional columns past F are ignored. Choose a <strong>default company</strong> below for matching.
        Validate first, then apply.
      </p>

      <div className="admin-card">
        <h2>1. Upload file</h2>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          onChange={handlePickFile}
          style={{ display: "block", marginBottom: "0.5rem" }}
        />
        {fileName && (
          <p style={{ margin: 0, color: "var(--admin-muted)", fontSize: "0.85rem" }}>
            Loaded: <strong>{fileName}</strong>
            {sheet ? ` — ${sheet.rows.length} data row${sheet.rows.length === 1 ? "" : "s"}` : ""}
          </p>
        )}
        {parseError && <p style={{ color: "#b91c1c", fontSize: "0.85rem", marginTop: "0.5rem" }}>{parseError}</p>}
      </div>

      {sheet && sheet.headers.length === 6 && (
        <>
          <div className="admin-card">
            <h2>2. Column layout &amp; defaults</h2>
            <p style={{ color: "var(--admin-muted)", fontSize: "0.8rem", marginTop: 0 }}>
              Columns are fixed by position (A–F). Anything in column G or beyond is not imported. Header text in row 1
              is for your reference only. Month + Year are combined as the first day of that month. Default fuel is
              optional if every row has Product filled.
            </p>
            <div className="admin-table-wrap" style={{ marginBottom: "0.75rem" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Col</th>
                    <th>Your header (row 1)</th>
                    <th>Import as</th>
                  </tr>
                </thead>
                <tbody>
                  {IMPORT_COL_KEYS.map((_, i) => (
                    <tr key={IMPORT_COL_KEYS[i]}>
                      <td>
                        <strong>{String.fromCharCode(65 + i)}</strong>
                      </td>
                      <td>{sheet.headers[i]}</td>
                      <td>{FIELD_LABELS[STANDARD_SIX_FIELDS[i]]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", maxWidth: "640px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.7rem", textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.25rem" }}>
                  Default fuel type (whole file)
                </label>
                <select
                  className="admin-input"
                  value={defaults.fuelType}
                  onChange={(e) =>
                    setDefaults((d) => ({
                      ...d,
                      fuelType: e.target.value as "" | "OIL" | "PROP" | "PROPANE",
                    }))
                  }
                  style={{ width: "100%" }}
                >
                  <option value="">— use Product column —</option>
                  <option value="OIL">OIL</option>
                  <option value="PROP">PROP</option>
                  <option value="PROPANE">PROPANE</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.7rem", textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.25rem" }}>
                  Default company (whole file)
                </label>
                <select
                  className="admin-input"
                  value={defaults.companySelection}
                  onChange={(e) =>
                    setDefaults((d) => ({
                      ...d,
                      companySelection: e.target.value,
                      ...(e.target.value === CUSTOM_COMPANY ? {} : { customCompanyName: "" }),
                    }))
                  }
                  style={{ width: "100%" }}
                >
                  <option value="">— choose company (required) —</option>
                  {oilCompanies.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                  <option value={CUSTOM_COMPANY}>Custom (type below)…</option>
                </select>
                {defaults.companySelection === CUSTOM_COMPANY && (
                  <input
                    className="admin-input"
                    value={defaults.customCompanyName}
                    onChange={(e) => setDefaults((d) => ({ ...d, customCompanyName: e.target.value }))}
                    placeholder="e.g. Saveway Petroleum"
                    style={{ width: "100%", marginTop: "0.35rem" }}
                  />
                )}
                {defaults.companySelection &&
                  defaults.companySelection !== CUSTOM_COMPANY &&
                  resolvedDefaultCompanyName && (
                    <p style={{ color: "var(--admin-muted)", fontSize: "0.72rem", margin: "0.25rem 0 0" }}>
                      Will match member rows where{" "}
                      <code>legacyProfile.oilCompanyName</code> or the linked Oil Company is{" "}
                      <strong>{resolvedDefaultCompanyName}</strong>.
                    </p>
                  )}
              </div>
            </div>
            {builtRows.dateMode === "monthYear" && (
              <p style={{ color: "var(--admin-muted)", fontSize: "0.8rem", margin: "0.75rem 0 0" }}>
                Using <strong>Month + Year</strong> columns to synthesize dates as the first of the month
                {builtRows.rows.length > 0 && builtRows.rows[0].dateDelivered
                  ? ` (e.g. row 1 → ${builtRows.rows[0].dateDelivered})`
                  : ""}
                .
              </p>
            )}
            {builtRows.missingFields.length > 0 && (
              <p style={{ color: "#b45309", fontSize: "0.85rem", margin: "0.75rem 0 0" }}>
                Missing required field(s): {builtRows.missingFields.join(", ")}
              </p>
            )}
          </div>

          <div className="admin-card">
            <h2>3. Preview ({Math.min(previewRows.length, 8)} of {sheet.rows.length})</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    {sheet.headers.map((h, i) => (
                      <th key={i}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => (
                    <tr key={i}>
                      {IMPORT_COL_KEYS.map((k, j) => (
                        <td key={j}>{String(r[k] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin-card">
            <h2>4. Validate &amp; apply</h2>
            <p style={{ color: "var(--admin-muted)", fontSize: "0.8rem", marginTop: 0 }}>
              Validate runs the matching logic without changing any data. Apply will append rows to matched
              members and skip duplicates already on file.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="admin-btn"
                onClick={() => void postImport(true)}
                disabled={!canRun || busy}
              >
                {busy && reportMode === "validate" ? "Validating…" : "Validate (dry run)"}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={() => void postImport(false)}
                disabled={!canRun || busy}
              >
                {busy && reportMode === "apply" ? "Applying…" : "Apply import"}
              </button>
            </div>
          </div>
        </>
      )}

      {report && (
        <ImportReportCard report={report} mode={reportMode} />
      )}
    </>
  );
}

function ImportReportCard({ report, mode }: { report: ServerImportResponse; mode: "validate" | "apply" | null }) {
  const s = report.summary;
  return (
    <div className="admin-card">
      <h2>{mode === "validate" ? "Validation result" : "Import result"}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.5rem", marginBottom: "1rem" }}>
        <Stat label="Total rows" value={s.totalRows} />
        <Stat label="Matched" value={s.matched} ok />
        {s.appended != null && <Stat label="Appended" value={s.appended} ok />}
        <Stat label="Unmatched" value={s.unmatched} warn={s.unmatched > 0} />
        <Stat label="Ambiguous" value={s.ambiguous} warn={s.ambiguous > 0} />
        <Stat label="Invalid / dup" value={s.invalid} warn={s.invalid > 0} />
      </div>

      {report.unmatched.length > 0 && (
        <ReportTable
          title="Unmatched rows"
          rows={report.unmatched.map((u) => ({
            "Row #": u.rowNumber,
            Fuel: u.fuelType,
            Company: u.companyName,
            Account: u.account,
          }))}
        />
      )}

      {report.ambiguous.length > 0 && (
        <ReportTable
          title="Ambiguous rows (multiple member candidates)"
          rows={report.ambiguous.map((a) => ({
            "Row #": a.rowNumber,
            Company: a.companyName,
            Account: a.account,
            "Candidate IDs": a.candidateMemberIds.join(", "),
          }))}
        />
      )}

      {report.errors.length > 0 && (
        <ReportTable
          title="Invalid / duplicate rows"
          rows={report.errors.map((e) => ({
            "Row #": e.rowNumber,
            Reason: e.reason,
            Detail: e.detail ? JSON.stringify(e.detail) : "",
          }))}
        />
      )}
    </div>
  );
}

function Stat({ label, value, ok, warn }: { label: string; value: number; ok?: boolean; warn?: boolean }) {
  const color = ok ? "#15803d" : warn ? "#b45309" : "var(--admin-text)";
  return (
    <div className="admin-stat" style={{ padding: "0.5rem 0.75rem" }}>
      <strong style={{ color, fontSize: "1.4rem" }}>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ReportTable({ title, rows }: { title: string; rows: Array<Record<string, string | number>> }) {
  if (rows.length === 0) return null;
  const headers = Object.keys(rows[0]);
  return (
    <>
      <h3 style={{ margin: "0.5rem 0", fontSize: "0.9rem" }}>{title}</h3>
      <div className="admin-table-wrap" style={{ marginBottom: "0.75rem", maxHeight: "320px", overflowY: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {headers.map((h) => (
                  <td key={h}>{String(r[h] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
