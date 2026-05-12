import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../api";
import { useAuth } from "../authContext";

type OilCompany = { _id: string; name: string };
const CUSTOM_COMPANY = "__custom__";

/**
 * Import delivery summaries from Excel/CSV files emailed by oil & propane
 * companies. Workflow:
 *   1) User picks a file. We parse it client-side and show a preview.
 *   2) User maps each spreadsheet column to a semantic field.
 *      Default co-op layout is 6 columns: Product, OIL ID / PROP ID, GAL, Month, Year, Name (ignored).
 *      Default values can be supplied for whole-file constants (e.g. company when not in the sheet).
 *   3) "Validate" runs a dry-run on the server: per-row matching against
 *      members by (fuel, account, company), with detailed error report.
 *   4) "Apply" actually appends rows to matched members. Duplicates
 *      (same date+fuel+gallons) are skipped, surfaced in the report.
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

type ParsedSheet = {
  headers: string[];
  rows: Array<Record<string, unknown>>;
};

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

/**
 * Standard co-op delivery spreadsheet: 6 columns in order —
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

/** When there are exactly 6 columns and each header matches this layout, map by position. */
function columnMatchesStandardSixSlot(header: string, slotIndex: number): boolean {
  const t = header.toLowerCase();
  switch (slotIndex) {
    case 0:
      return /\bproduct\b|\bfuel\b/.test(t);
    case 1:
      return (
        /\b(oil|prop(ane)?)\s*id\b/.test(t) ||
        /oil\s*id\s*\/\s*prop/i.test(t) ||
        /\bprop\s*id\b/.test(t)
      );
    case 2:
      return /^\s*gal(s)?\s*$/i.test(header.trim()) || /\bgal(lons)?\b/.test(t);
    case 3:
      return /\bmonth\b/.test(t);
    case 4:
      return /\byear\b/.test(t) && !/\bmonth\b/.test(t);
    case 5:
      return /\bname\b/.test(t) && !/\bcompany\b/.test(t);
    default:
      return false;
  }
}

function buildInitialColumnMapping(headers: string[]): Record<string, SemanticField> {
  const out: Record<string, SemanticField> = {};
  for (const h of headers) {
    out[h] = autoMapHeader(h);
  }
  if (headers.length === 6 && headers.every((h, i) => columnMatchesStandardSixSlot(h, i))) {
    for (let i = 0; i < 6; i++) {
      out[headers[i]] = STANDARD_SIX_FIELDS[i];
    }
  }
  return out;
}

function autoMapHeader(header: string): SemanticField {
  const h = header.toLowerCase().trim();
  // Column 6 in the standard layout: person name for cross-check only (not "company name").
  if (/^name\b/i.test(h) && !/company/.test(h)) return "ignore";
  if (/^year\b|\byear$/.test(h) || /\byear\s*\(/i.test(h)) return "year";
  if (/^month\b|\bmonth$/.test(h) || /\bmonth\s*\(/i.test(h)) return "month";
  if (/^\s*product\b/i.test(h) || /\bproduct\s*\(/i.test(h) || /^(fuel|type)\b/i.test(h)) return "fuelType";
  if (
    /\b(oil|prop(ane)?)\s*id\b/i.test(h) ||
    /oil\s*id\s*\/\s*prop/i.test(h) ||
    /\bprop\s*\/\s*oil\s*id\b/i.test(h)
  ) {
    return "account";
  }
  if (/(fuel|product)\b/i.test(h) && /\b(oil|prop)/i.test(h)) return "fuelType";
  if (/(acct|account|customer\s*#|cust\s*#|member\s*#)/i.test(h)) return "account";
  if (/(company|vendor|dealer|supplier|broker)/i.test(h)) return "companyName";
  if (/(date|delivered|delv|d\/l)/i.test(h)) return "dateDelivered";
  if (/(gal|gallon|qty|quantity|amount)/i.test(h)) return "gallons";
  return "ignore";
}

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
  const [mapping, setMapping] = useState<Record<string, SemanticField>>({});
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
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
          defval: "",
          raw: false,
        });
        if (json.length === 0) {
          setSheet({ headers: [], rows: [] });
          setMapping({});
          return;
        }
        const headerSet = new Set<string>();
        for (const r of json) for (const k of Object.keys(r)) headerSet.add(k);
        const headers = [...headerSet];
        setSheet({ headers, rows: json });
        setMapping(buildInitialColumnMapping(headers));
      } catch (err) {
        setParseError(err instanceof Error ? err.message : "Failed to parse file");
        setSheet(null);
        setMapping({});
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
      Object.entries(mapping).find(([, f]) => f === field)?.[0] ?? null;
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
  }, [sheet, mapping, defaults, resolvedDefaultCompanyName]);

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
    setMapping({});
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
        Upload an Excel or CSV file. The usual co-op layout is six columns:{" "}
        <strong>Product</strong> (OIL or PROP), <strong>OIL ID / PROP ID</strong>, <strong>GAL</strong>,{" "}
        <strong>Month</strong>, <strong>Year</strong>, and <strong>Name</strong> (reference only; not used for matching).
        Each row is matched to a member by fuel type, account number, and company name — set a default company below
        when the sheet has no company column. Validate first to review matches before applying.
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

      {sheet && sheet.headers.length > 0 && (
        <>
          <div className="admin-card">
            <h2>2. Map columns</h2>
            <p style={{ color: "var(--admin-muted)", fontSize: "0.8rem", marginTop: 0 }}>
              Column targets are guessed from headers (six-column co-op files map automatically). Required: account,
              gallons, month + year or a full date, and fuel unless you set a default. Company: map a column or choose
              a default for the whole file.
            </p>
            <div className="admin-table-wrap" style={{ marginBottom: "0.75rem" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: "40%" }}>Spreadsheet column</th>
                    <th>Maps to</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.headers.map((h) => (
                    <tr key={h}>
                      <td>
                        <strong>{h}</strong>
                      </td>
                      <td>
                        <select
                          className="admin-input"
                          value={mapping[h] || "ignore"}
                          onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value as SemanticField }))}
                        >
                          {(Object.keys(FIELD_LABELS) as SemanticField[]).map((f) => (
                            <option key={f} value={f}>
                              {FIELD_LABELS[f]}
                            </option>
                          ))}
                        </select>
                      </td>
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
                  <option value="">— none (use column) —</option>
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
                  <option value="">— none (use column) —</option>
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
                    {sheet.headers.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => (
                    <tr key={i}>
                      {sheet.headers.map((h) => (
                        <td key={h}>{String(r[h] ?? "")}</td>
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
