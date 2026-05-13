import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../api";
import { useAuth } from "../authContext";

type OilCompany = { _id: string; name: string };
const CUSTOM_COMPANY = "__custom__";

/**
 * Import delivery summaries from Excel/CSV. All columns through the sheet’s
 * detected width (up to a cap) are stored and can be mapped; row 1 is labels
 * only. Default mapping matches the common six-column co-op layout, with
 * extra columns defaulting to Ignore. Validate → dry-run; Apply → append rows.
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

/** Default “Import as” per column A–F (common co-op export). */
const STANDARD_SIX_FIELDS: SemanticField[] = [
  "fuelType",
  "account",
  "gallons",
  "month",
  "year",
  "ignore",
];

/** Max columns read/mapped per sheet (wider workbooks are truncated here). */
const MAX_IMPORT_COLUMNS = 40;

function importColKey(columnIndex: number): string {
  return `__c${columnIndex}`;
}

/** Dropdown order for “Import as”. */
const IMPORT_AS_OPTION_ORDER: SemanticField[] = [
  "fuelType",
  "account",
  "gallons",
  "month",
  "year",
  "dateDelivered",
  "companyName",
  "ignore",
];

type ParsedSheet = {
  /** Row-1 label for every imported column (width = min(widest row, cap), at least 6). */
  allHeaders: string[];
  /** First six headers (same as allHeaders.slice(0, 6) when padded). */
  headers: string[];
  /** Data rows; keys `__c0` … `__c{n-1}` for each imported column. */
  rows: Array<Record<string, unknown>>;
  /** Parallel to rows: full-width cell values for preview (length matches allHeaders). */
  rowCellsWide: unknown[][];
  /** Widest column count in the raw workbook (before cap). */
  fullColumnCount: number;
};

/** If a column header is exactly "YEAR", use that column for Year and clear the previous Year slot (common PETRI layout). */
function withYearColumnFromHeaders(allHeaders: string[], mapping: SemanticField[]): SemanticField[] {
  const next = [...mapping];
  const yearHeaderIdx = allHeaders.findIndex((h) => /^\s*YEAR\s*$/i.test(h));
  if (yearHeaderIdx < 0) return next;
  const prevYearCol = next.indexOf("year");
  if (prevYearCol >= 0 && prevYearCol !== yearHeaderIdx) {
    next[prevYearCol] = "ignore";
  }
  next[yearHeaderIdx] = "year";
  return next;
}

/** If user picks a non-ignore field already used on another column, swap assignments. */
function applyColumnMappingChange(prev: SemanticField[], colIndex: number, field: SemanticField): SemanticField[] {
  const next = [...prev];
  if (field === "ignore") {
    next[colIndex] = "ignore";
    return next;
  }
  const other = next.findIndex((f, i) => i !== colIndex && f === field);
  if (other >= 0) {
    const tmp = next[colIndex];
    next[colIndex] = field;
    next[other] = tmp;
    return next;
  }
  next[colIndex] = field;
  return next;
}

/** Highest column count present in any row of the sheet. */
function gridMaxColumns(grid: unknown[][]): number {
  let w = 0;
  for (const row of grid) {
    if (Array.isArray(row) && row.length > w) w = row.length;
  }
  return w;
}

/** 0-based column index to Excel-style letter(s): 0→A, 25→Z, 26→AA. */
function columnIndexToLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Highest 1-based column index ≤ n that has a non-empty cell in columns 0..n-1. */
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

/** Typical row-1 labels from the co-op export; used as card-2 mapping and fallback when a cell is blank. */
const SIX_COLUMN_TYPICAL_HEADERS = [
  "MONTH",
  "PRODUCT",
  "OIL ID",
  "NAME",
  "GAL",
  "Hidden Net Sales Volume",
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
  /** One entry per imported sheet column (same length as sheet.allHeaders). */
  const [columnMapping, setColumnMapping] = useState<SemanticField[]>(() => [...STANDARD_SIX_FIELDS]);
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
          setSheet({ allHeaders: [], headers: [], rows: [], rowCellsWide: [], fullColumnCount: 0 });
          setColumnMapping([...STANDARD_SIX_FIELDS]);
          return;
        }

        const wide = gridMaxColumns(grid);
        const maxCol = Math.min(Math.max(wide, 6), MAX_IMPORT_COLUMNS);
        const usedInFile = maxUsedColumnIndexFirstN(grid, maxCol);
        if (usedInFile < 1) {
          setParseError(
            "No data found in the sheet. Add at least one value on row 2 or below in an imported column."
          );
          setSheet(null);
          return;
        }
        const row0 = [...(grid[0] ?? [])];
        while (row0.length < maxCol) row0.push("");
        const allHeaders = row0.map((c, i) => {
          const t = String(c ?? "").trim();
          if (t) return t;
          if (i < 6) return SIX_COLUMN_TYPICAL_HEADERS[i];
          return "";
        });
        const headers = allHeaders.slice(0, 6);

        const rows: Array<Record<string, unknown>> = [];
        const rowCellsWide: unknown[][] = [];
        for (let r = 1; r < grid.length; r++) {
          const cells = [...(grid[r] ?? [])];
          while (cells.length < maxCol) cells.push("");
          const o: Record<string, unknown> = {};
          for (let i = 0; i < maxCol; i++) o[importColKey(i)] = cells[i] ?? "";
          rows.push(o);
          rowCellsWide.push(cells.slice(0, maxCol));
        }

        const mappingInit = withYearColumnFromHeaders(
          allHeaders,
          (() => {
            const m = [...STANDARD_SIX_FIELDS];
            while (m.length < maxCol) m.push("ignore");
            return m;
          })()
        );

        setSheet({ allHeaders, headers, rows, rowCellsWide, fullColumnCount: wide });
        setColumnMapping(mappingInit);
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
        mappingErrors: [] as string[],
        dateMode: "none" as "date" | "monthYear" | "none",
      };

    const map: SemanticField[] =
      columnMapping.length >= sheet.allHeaders.length
        ? columnMapping.slice(0, sheet.allHeaders.length)
        : [
            ...columnMapping,
            ...Array(sheet.allHeaders.length - columnMapping.length).fill("ignore" as SemanticField),
          ];

    const colKeyForField = (field: SemanticField): string | null => {
      const idx = map.indexOf(field);
      return idx >= 0 ? importColKey(idx) : null;
    };

    const mappingErrors: string[] = [];
    const counts = new Map<SemanticField, number>();
    for (const f of map) {
      if (f === "ignore") continue;
      counts.set(f, (counts.get(f) || 0) + 1);
    }
    for (const [field, n] of counts) {
      if (n > 1) mappingErrors.push(`${FIELD_LABELS[field]} is assigned to more than one column — use each import target at most once (except Ignore).`);
    }

    const cols = {
      fuelType: colKeyForField("fuelType"),
      account: colKeyForField("account"),
      companyName: colKeyForField("companyName"),
      dateDelivered: colKeyForField("dateDelivered"),
      month: colKeyForField("month"),
      year: colKeyForField("year"),
      gallons: colKeyForField("gallons"),
    };

    const dateMode: "date" | "monthYear" | "none" = cols.dateDelivered
      ? "date"
      : cols.month && cols.year
        ? "monthYear"
        : "none";

    const missingFields: string[] = [];
    if (mappingErrors.length === 0) {
      if (!cols.account) missingFields.push("account");
      if (dateMode === "none") missingFields.push("dateDelivered (or Month + Year)");
      if (!cols.gallons) missingFields.push("gallons");
      if (!cols.fuelType && !defaults.fuelType) missingFields.push("fuelType");
      if (!cols.companyName && !resolvedDefaultCompanyName) missingFields.push("companyName");
    }

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
        rowNumber: i + 2,
        fuelType: cell(cols.fuelType) || defaults.fuelType,
        account: cell(cols.account),
        companyName: cell(cols.companyName) || resolvedDefaultCompanyName,
        dateDelivered,
        gallons: Number(String(gallonsRaw).replace(/[^\d.\-]/g, "")) || 0,
      };
    });
    return { rows, missingFields, mappingErrors, dateMode };
  }, [sheet, columnMapping, defaults, resolvedDefaultCompanyName]);

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
    setColumnMapping([...STANDARD_SIX_FIELDS]);
    if (inputRef.current) inputRef.current.value = "";
  }

  const previewWideRows = sheet?.rowCellsWide.slice(0, 8) ?? [];
  const canRun =
    sheet &&
    sheet.rows.length > 0 &&
    builtRows.missingFields.length === 0 &&
    builtRows.mappingErrors.length === 0;

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
        Up to <strong>{MAX_IMPORT_COLUMNS}</strong> columns (through the widest row) are loaded and can be mapped. Row 1
        is <strong>Your header</strong> for reference. If a column is named <strong>YEAR</strong>, it is used for the
        year field automatically when you load the file. Month + Year combine to the first day of that month. Choose a{" "}
        <strong>default company</strong> when no column maps to company name. Validate first, then apply.
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

      {sheet && sheet.rows.length > 0 && (
        <>
          <div className="admin-card">
            <h2>2. Column layout &amp; defaults</h2>
            <p style={{ color: "var(--admin-muted)", fontSize: "0.8rem", marginTop: 0 }}>
              <strong>Your header (row 1)</strong> lists every column in the loaded width (widest row). Map each column
              with <strong>Import as</strong> (defaults match the classic six-column export; extras default to Ignore).
              Month + Year combine as the first of the month. Default fuel applies when no column maps to fuel type.
              Choosing a target already used elsewhere swaps assignments (except <strong>Ignore</strong>).
            </p>
            {sheet.fullColumnCount > MAX_IMPORT_COLUMNS && (
              <p style={{ color: "#b45309", fontSize: "0.8rem", marginTop: "0.35rem" }}>
                This workbook has <strong>{sheet.fullColumnCount}</strong> columns; only the first{" "}
                <strong>{MAX_IMPORT_COLUMNS}</strong> are loaded. Widen the cap in code if you need more.
              </p>
            )}
            <p style={{ margin: "0 0 0.75rem" }}>
              <button
                type="button"
                className="admin-btn"
                style={{ fontSize: "0.8rem", padding: "0.25rem 0.6rem" }}
                onClick={() => {
                  if (!sheet) return;
                  const n = sheet.allHeaders.length;
                  const base = [...STANDARD_SIX_FIELDS];
                  while (base.length < n) base.push("ignore");
                  setColumnMapping(withYearColumnFromHeaders(sheet.allHeaders, base));
                }}
              >
                Restore default column mapping
              </button>
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
                  {sheet.allHeaders.map((headerText, i) => (
                    <tr key={i}>
                      <td>
                        <strong>{columnIndexToLetter(i)}</strong>
                      </td>
                      <td>{headerText || (i < 6 ? SIX_COLUMN_TYPICAL_HEADERS[i] : "—")}</td>
                      <td>
                        <select
                          className="admin-input"
                          style={{ minWidth: "min(100%, 280px)", fontSize: "0.8rem" }}
                          value={columnMapping[i] ?? "ignore"}
                          onChange={(e) =>
                            setColumnMapping((prev) =>
                              applyColumnMappingChange(prev, i, e.target.value as SemanticField)
                            )
                          }
                          aria-label={`Column ${columnIndexToLetter(i)} import as`}
                        >
                          {IMPORT_AS_OPTION_ORDER.map((field) => (
                            <option key={field} value={field}>
                              {FIELD_LABELS[field]}
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
                  <option value="">— use mapped “Fuel type” column —</option>
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
                  <option value="">— choose company (required if no “Company name” column) —</option>
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
            {builtRows.dateMode === "date" && (
              <p style={{ color: "var(--admin-muted)", fontSize: "0.8rem", margin: "0.75rem 0 0" }}>
                Using the column mapped to <strong>Date delivered</strong> as each row’s delivery date.
              </p>
            )}
            {builtRows.dateMode === "monthYear" && (
              <p style={{ color: "var(--admin-muted)", fontSize: "0.8rem", margin: "0.75rem 0 0" }}>
                Using <strong>Month + Year</strong> columns to synthesize dates as the first of the month
                {builtRows.rows.length > 0 && builtRows.rows[0].dateDelivered
                  ? ` (e.g. row 1 → ${builtRows.rows[0].dateDelivered})`
                  : ""}
                .
              </p>
            )}
            {builtRows.mappingErrors.length > 0 && (
              <ul style={{ color: "#b91c1c", fontSize: "0.85rem", margin: "0.75rem 0 0", paddingLeft: "1.25rem" }}>
                {builtRows.mappingErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
            {builtRows.missingFields.length > 0 && (
              <p style={{ color: "#b45309", fontSize: "0.85rem", margin: "0.75rem 0 0" }}>
                Missing required field(s): {builtRows.missingFields.join(", ")}
              </p>
            )}
          </div>

          <div className="admin-card">
            <h2>3. Preview ({Math.min(previewWideRows.length, 8)} of {sheet.rows.length})</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    {sheet.allHeaders.map((h, i) => (
                      <th key={i} title={`Column ${columnIndexToLetter(i)}`}>
                        {h || (i < 6 ? SIX_COLUMN_TYPICAL_HEADERS[i] : columnIndexToLetter(i))}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewWideRows.map((cells, ri) => (
                    <tr key={ri}>
                      {cells.map((cell, ci) => (
                        <td key={ci}>{String(cell ?? "")}</td>
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
