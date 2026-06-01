import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { api } from "../api";
import { useAuth } from "../authContext";

type OilCompany = { _id: string; name: string; active?: boolean };
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
  | "name"
  | "nameFirst"
  | "nameLast"
  | "address"
  | "ignore";

/**
 * Default “Import as” per column A–F for the classic co-op layout
 * [MONTH, PRODUCT, OIL ID, NAME, GAL, Hidden]. NAME is reference-only — matching
 * is by account / oil ID only (never company or customer name) — but we keep it parsed so
 * the unrecognized-customer prompt can suggest a first/last name.
 */
const STANDARD_SIX_FIELDS: SemanticField[] = [
  "month",
  "fuelType",
  "account",
  "name",
  "gallons",
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
  "name",
  "nameFirst",
  "nameLast",
  "address",
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

/**
 * Headers that should default to "Ignore" on first load: junk dollar columns
 * from vendor exports ("Net Sales Volume", "Hidden Net Sales Volume") and any
 * column with no header text. Admins can still re-map them by hand if needed.
 */
const AUTO_IGNORE_HEADER_RX = /(^$|net\s*sales|hidden)/i;
function withAutoIgnoredHeaders(allHeaders: string[], mapping: SemanticField[]): SemanticField[] {
  const next = [...mapping];
  for (let i = 0; i < allHeaders.length; i++) {
    if (AUTO_IGNORE_HEADER_RX.test(String(allHeaders[i] || "").trim())) {
      next[i] = "ignore";
    }
  }
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

type FirstDeliveryMemberInfo = {
  memberId: string;
  memberNumber: string;
  name: string;
  rowNumbers: number[];
  rowCount: number;
};

type UnmatchHint = {
  code: string;
  message: string;
  memberIds?: string[];
};

type UnmatchedGroupInfo = {
  groupKey: string;
  fuelType: "OIL" | "PROPANE";
  companyName: string;
  account: string;
  rowCount: number;
  rowNumbers: number[];
  suggestedName: string;
  hint?: UnmatchHint;
};

type ServerImportResponse = {
  importBatchId: string;
  fileName: string;
  dryRun: boolean;
  summary: {
    totalRows: number;
    matched: number;
    appended?: number;
    skippedFirstDelivery?: number;
    createdMembers?: number;
    matchedExistingGroups?: number;
    firstDeliveryMembers?: number;
    unmatched: number;
    unmatchedGroups?: number;
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
  firstDeliveryMembers?: FirstDeliveryMemberInfo[];
  unmatched: Array<{
    rowNumber: number;
    groupKey?: string;
    companyName: string;
    account: string;
    fuelType: string;
    name?: string;
    address?: string;
    hint?: UnmatchHint;
  }>;
  unmatchedGroups?: UnmatchedGroupInfo[];
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
  createdMembers?: Array<{
    memberId: string;
    memberNumber: string;
    firstName: string;
    lastName: string;
  }>;
  matchedExisting?: Array<{
    groupKey: string;
    memberId: string;
    memberNumber: string;
    memberName: string;
    fuelType: "OIL" | "PROPANE";
    account: string;
    rowsAppended: number;
    stampedAccount: boolean;
  }>;
};

type UnmatchedGroupMode = "skip" | "create" | "match";
type UnmatchedGroupDecision = {
  mode: UnmatchedGroupMode;
  firstName: string;
  lastName: string;
  matchMemberId: string;
  matchMemberLabel: string;
};
// Legacy alias — many call-sites still reference the old type name.
type CreateMemberDecision = UnmatchedGroupDecision;

const FIELD_LABELS: Record<SemanticField, string> = {
  fuelType: "Fuel type (OIL / PROP / PROPANE)",
  account: "Account # (oil ID or propane ID — used for matching)",
  companyName: "Company name (optional — not used for matching)",
  dateDelivered: "Date delivered (full date)",
  month: "Month (1–12 or name; pair with Year)",
  year: "Year (YYYY; pair with Month)",
  gallons: "Gallons (GAL)",
  name: "Customer name (reference only — pre-fills new-member prompt)",
  nameFirst: "Name first (combine with Name last → customer name)",
  nameLast: "Name last (combine with Name first → customer name)",
  address: "Service address (reference only — shown for unmatched rows)",
  ignore: "Ignore",
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

/** Build reference name from mapped columns (full name and/or first + last). */
function buildImportName(
  fullName: string,
  firstName: string,
  lastName: string,
  hasNameCol: boolean,
  hasFirstCol: boolean,
  hasLastCol: boolean
): string {
  if (hasFirstCol && hasLastCol) {
    const combined = `${firstName} ${lastName}`.trim();
    if (combined) return combined;
  }
  if (hasNameCol && fullName) return fullName;
  if (hasFirstCol || hasLastCol) return `${firstName} ${lastName}`.trim();
  return "";
}

/** One row in the POST body to `/api/admin/deliveries/import` (same shape as validate/apply). */
type ImportPayloadRow = {
  rowNumber: number;
  fuelType: string;
  account: string;
  companyName: string;
  dateDelivered: string;
  gallons: number;
  name?: string;
  address?: string;
};

const IMPORT_PAYLOAD_PREVIEW_COLUMNS: { key: keyof ImportPayloadRow; label: string }[] = [
  { key: "rowNumber", label: "Row #" },
  { key: "account", label: "Account / oil ID (matched)" },
  { key: "fuelType", label: "Fuel (oil vs propane slot)" },
  { key: "dateDelivered", label: "Date delivered" },
  { key: "gallons", label: "Gallons" },
];

function importPreviewColumnsForMapping(map: SemanticField[]): { key: keyof ImportPayloadRow; label: string }[] {
  const cols = [...IMPORT_PAYLOAD_PREVIEW_COLUMNS];
  const has = (f: SemanticField) => map.includes(f);
  if (has("name") || has("nameFirst") || has("nameLast")) {
    cols.push({ key: "name", label: "Name" });
  }
  if (has("companyName")) cols.push({ key: "companyName", label: "Company (not matched)" });
  if (has("address")) cols.push({ key: "address", label: "Address" });
  return cols;
}

function formatImportPreviewCell(row: ImportPayloadRow, key: keyof ImportPayloadRow): string {
  const v = row[key];
  if (v == null || v === "") return "—";
  return key === "gallons" ? String(v) : String(v);
}

/** Split a raw "FIRST LAST" string into name parts for the new-member prompt. */
function splitSuggestedName(raw: string): { firstName: string; lastName: string } {
  const s = String(raw || "").trim();
  if (!s) return { firstName: "", lastName: "" };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
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

  /**
   * Per-validate confirmation state. Keyed by:
   *  - memberId for first-delivery members (checkbox: apply their rows)
   *  - groupKey for unmatched (toggle + first/last name to create a new member)
   * Reset every time validate produces a fresh report.
   */
  const [firstDeliveryConfirms, setFirstDeliveryConfirms] = useState<Record<string, boolean>>({});
  const [createMemberDecisions, setCreateMemberDecisions] = useState<Record<string, CreateMemberDecision>>({});

  useEffect(() => {
    if (!token) return;
    api<{ oilCompanies: OilCompany[] }>("/api/admin/oil-companies?includeInactive=1", { token })
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
          withAutoIgnoredHeaders(
            allHeaders,
            (() => {
              const m = [...STANDARD_SIX_FIELDS];
              while (m.length < maxCol) m.push("ignore");
              return m;
            })()
          )
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
        rows: [] as ImportPayloadRow[],
        missingFields: [] as string[],
        mappingErrors: [] as string[],
        dateMode: "none" as "date" | "monthYear" | "none",
        ignoredColumnIndices: [] as number[],
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

    const ignoredColumnIndices: number[] = [];
    for (let i = 0; i < map.length; i++) if (map[i] === "ignore") ignoredColumnIndices.push(i);

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
      name: colKeyForField("name"),
      nameFirst: colKeyForField("nameFirst"),
      nameLast: colKeyForField("nameLast"),
      address: colKeyForField("address"),
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
      const nameCell = buildImportName(
        cell(cols.name),
        cell(cols.nameFirst),
        cell(cols.nameLast),
        Boolean(cols.name),
        Boolean(cols.nameFirst),
        Boolean(cols.nameLast)
      );
      const addressCell = cell(cols.address);
      return {
        rowNumber: i + 2,
        fuelType: cell(cols.fuelType) || defaults.fuelType,
        account: cell(cols.account),
        companyName: cell(cols.companyName) || resolvedDefaultCompanyName,
        dateDelivered,
        gallons: Number(String(gallonsRaw).replace(/[^\d.\-]/g, "")) || 0,
        ...(nameCell ? { name: nameCell } : {}),
        ...(addressCell ? { address: addressCell } : {}),
      };
    });
    return { rows, missingFields, mappingErrors, dateMode, ignoredColumnIndices };
  }, [sheet, columnMapping, defaults, resolvedDefaultCompanyName]);

  async function postImport(dryRun: boolean) {
    if (!token || builtRows.rows.length === 0) return;
    setBusy(true);
    try {
      const confirmedFirstDelivery = Object.entries(firstDeliveryConfirms)
        .filter(([, v]) => v)
        .map(([id]) => id);
      const createMembers: Record<string, { firstName: string; lastName: string }> = {};
      const matchToMember: Record<string, { memberId: string }> = {};
      for (const [groupKey, d] of Object.entries(createMemberDecisions)) {
        if (d.mode === "create") {
          const firstName = d.firstName.trim();
          const lastName = d.lastName.trim();
          if (!firstName || !lastName) continue;
          createMembers[groupKey] = { firstName, lastName };
        } else if (d.mode === "match") {
          const memberId = d.matchMemberId.trim();
          if (!memberId) continue;
          matchToMember[groupKey] = { memberId };
        }
      }
      const r = await api<ServerImportResponse>(`/api/admin/deliveries/import`, {
        method: "POST",
        token,
        body: JSON.stringify({
          fileName,
          dryRun,
          rows: builtRows.rows,
          ...(dryRun
            ? {}
            : {
                confirmations: {
                  firstDeliveryMemberIds: confirmedFirstDelivery,
                  createMembers,
                  matchToMember,
                },
              }),
        }),
      });
      setReport(r);
      setReportMode(dryRun ? "validate" : "apply");
      if (dryRun) {
        // Seed defaults from the fresh dry-run: first-delivery members default
        // to unchecked (admin must confirm), unmatched groups default to "skip"
        // with the suggested name pre-filled.
        const fd: Record<string, boolean> = {};
        for (const m of r.firstDeliveryMembers || []) fd[m.memberId] = false;
        setFirstDeliveryConfirms(fd);
        const cm: Record<string, UnmatchedGroupDecision> = {};
        for (const g of r.unmatchedGroups || []) {
          const { firstName, lastName } = splitSuggestedName(g.suggestedName);
          cm[g.groupKey] = {
            mode: "skip",
            firstName,
            lastName,
            matchMemberId: "",
            matchMemberLabel: "",
          };
        }
        setCreateMemberDecisions(cm);
      }
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
    setFirstDeliveryConfirms({});
    setCreateMemberDecisions({});
    if (inputRef.current) inputRef.current.value = "";
  }

  const importPreviewColumns = useMemo(() => {
    if (!sheet) return [];
    const map: SemanticField[] =
      columnMapping.length >= sheet.allHeaders.length
        ? columnMapping.slice(0, sheet.allHeaders.length)
        : [
            ...columnMapping,
            ...Array(sheet.allHeaders.length - columnMapping.length).fill("ignore" as SemanticField),
          ];
    return importPreviewColumnsForMapping(map);
  }, [sheet, columnMapping]);

  const importPreviewRows = builtRows.rows.slice(0, 8);
  const fuelTypeColumnMapped = columnMapping.includes("fuelType");

  useEffect(() => {
    if (fuelTypeColumnMapped && defaults.fuelType) {
      setDefaults((d) => ({ ...d, fuelType: "" }));
    }
  }, [fuelTypeColumnMapped, defaults.fuelType]);

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
        <strong>default company</strong> only when creating new members from unmatched rows (not used for matching).
        Matching uses <strong>account / oil ID</strong> only (oil ID for OIL rows, propane ID for PROPANE rows), not
        company name or customer name. Unmatched rows are listed with hints so you can add missing IDs on the member or
        create a member. Validate first, then apply.
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
              Map <strong>Name first</strong> and <strong>Name last</strong> on separate columns to build the customer name
              for unmatched-row hints and new-member prompts. Month + Year combine as the first of the month. Default fuel
              applies when no column maps to fuel type.
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
                  setColumnMapping(
                    withYearColumnFromHeaders(
                      sheet.allHeaders,
                      withAutoIgnoredHeaders(sheet.allHeaders, base)
                    )
                  );
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: fuelTypeColumnMapped ? "1fr" : "1fr 1fr",
                gap: "0.75rem",
                maxWidth: "640px",
              }}
            >
              {!fuelTypeColumnMapped && (
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
                    <option value="">— pick a default —</option>
                    <option value="OIL">OIL</option>
                    <option value="PROP">PROP</option>
                    <option value="PROPANE">PROPANE</option>
                  </select>
                  <p style={{ color: "var(--admin-muted)", fontSize: "0.72rem", margin: "0.25rem 0 0" }}>
                    Only needed because no column is mapped to <strong>Fuel type</strong>. Map a column instead to remove this.
                  </p>
                </div>
              )}
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
                  <option value="">— optional: company for new members only —</option>
                  {oilCompanies.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.active === false ? `${c.name} (inactive)` : c.name}
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
                      Used when creating new members from unmatched groups — not for row matching.
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
            <h2>3. Import preview ({importPreviewRows.length} of {sheet.rows.length} rows)</h2>
            <p style={{ color: "var(--admin-muted)", fontSize: "0.75rem", margin: "-0.25rem 0 0.5rem" }}>
              Each row below is the exact record sent when you <strong>Validate</strong> or <strong>Apply</strong> (after
              column mapping and file defaults). Name first + Name last are merged into <strong>Name</strong>; Month +
              Year become <strong>Date delivered</strong>.
            </p>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    {importPreviewColumns.map((col) => (
                      <th key={col.key}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importPreviewRows.map((row) => (
                    <tr key={row.rowNumber}>
                      {importPreviewColumns.map((col) => (
                        <td key={col.key}>{formatImportPreviewCell(row, col.key)}</td>
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
              Validate runs the matcher without saving. Apply appends deliveries to members that matched; it skips
              duplicates already on file. Rows that need attention: <strong>first delivery</strong> (matched member but
              no history yet — confirm), <strong>unmatched</strong> (no member with that account / oil ID — review hints,
              update IDs, or create a member), and <strong>ambiguous</strong> (more than one member matches — nothing is
              imported until data is fixed).
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
        <ImportReportCard
          report={report}
          mode={reportMode}
          firstDeliveryConfirms={firstDeliveryConfirms}
          setFirstDeliveryConfirms={setFirstDeliveryConfirms}
          createMemberDecisions={createMemberDecisions}
          setCreateMemberDecisions={setCreateMemberDecisions}
        />
      )}
    </>
  );
}

type ImportReportCardProps = {
  report: ServerImportResponse;
  mode: "validate" | "apply" | null;
  firstDeliveryConfirms: Record<string, boolean>;
  setFirstDeliveryConfirms: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  createMemberDecisions: Record<string, CreateMemberDecision>;
  setCreateMemberDecisions: React.Dispatch<React.SetStateAction<Record<string, CreateMemberDecision>>>;
};

function formatImportErrorReason(reason: string, detail?: Record<string, unknown>): string {
  if (reason === "ambiguous_not_imported") {
    const ids = Array.isArray(detail?.candidateMemberIds)
      ? (detail.candidateMemberIds as string[]).join(", ")
      : "";
    return `Multiple members share this account / oil ID; it was not imported. Resolve duplicate IDs on members. Candidates: ${ids || "(none)"}`;
  }
  if (reason === "duplicate_skipped") return "Same date, fuel, and gallons already on file — skipped.";
  return reason;
}

function UnmatchedRowsDetailTable({
  title,
  rows,
  mode,
}: {
  title: string;
  rows: ServerImportResponse["unmatched"];
  mode: "validate" | "apply" | null;
}) {
  if (rows.length === 0) return null;
  return (
    <>
      <h3 style={{ margin: "0.5rem 0", fontSize: "0.9rem" }}>{title}</h3>
      <p style={{ color: "var(--admin-muted)", fontSize: "0.78rem", margin: "0 0 0.5rem" }}>
        {mode === "apply"
          ? "These rows were discarded on Apply (group decision was Skip). Nothing is stored — re-import the file and choose Match or Create to keep them."
          : "Use hints to update the member's oil or propane account ID, or set the group decision above to Match / Create. Skipped rows are discarded — they are not saved anywhere."}
        {" "}Name and address come from the file only when mapped.
      </p>
      <div className="admin-table-wrap" style={{ marginBottom: "0.75rem", maxHeight: "420px", overflowY: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Row #</th>
              <th>Fuel</th>
              <th>Company</th>
              <th>Account</th>
              <th>Name</th>
              <th>Address</th>
              <th>Hint</th>
              <th>Members</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u, i) => (
              <tr key={`${u.rowNumber}-${i}`}>
                <td>{u.rowNumber}</td>
                <td>{u.fuelType}</td>
                <td>{u.companyName}</td>
                <td>{u.account}</td>
                <td>{u.name || "—"}</td>
                <td style={{ maxWidth: "10rem", fontSize: "0.78rem" }}>{u.address || "—"}</td>
                <td style={{ maxWidth: "22rem", fontSize: "0.78rem" }} title={u.hint?.message}>
                  {u.hint?.message || "—"}
                </td>
                <td style={{ whiteSpace: "nowrap", fontSize: "0.78rem" }}>
                  {u.hint?.memberIds?.length ? (
                    u.hint.memberIds.map((id) => (
                      <Link key={id} to={`/admin/members/${id}`} style={{ marginRight: "0.5rem" }} title={id}>
                        Profile
                      </Link>
                    ))
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ImportReportCard({
  report,
  mode,
  firstDeliveryConfirms,
  setFirstDeliveryConfirms,
  createMemberDecisions,
  setCreateMemberDecisions,
}: ImportReportCardProps) {
  const s = report.summary;
  const firstDeliveryMembers = report.firstDeliveryMembers || [];
  const unmatchedGroups = report.unmatchedGroups || [];
  const isValidate = mode === "validate";

  return (
    <div className="admin-card">
      <h2>{isValidate ? "Validation result" : "Import result"}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.5rem", marginBottom: "1rem" }}>
        <Stat label="Total rows" value={s.totalRows} />
        <Stat label="Matched" value={s.matched} ok />
        {s.appended != null && <Stat label="Appended" value={s.appended} ok />}
        {firstDeliveryMembers.length > 0 && (
          <Stat label="First-delivery customers" value={firstDeliveryMembers.length} warn />
        )}
        {s.createdMembers != null && s.createdMembers > 0 && (
          <Stat label="New members" value={s.createdMembers} ok />
        )}
        {s.matchedExistingGroups != null && s.matchedExistingGroups > 0 && (
          <Stat label="Matched to existing" value={s.matchedExistingGroups} ok />
        )}
        {s.skippedFirstDelivery != null && s.skippedFirstDelivery > 0 && (
          <Stat label="Skipped (unconfirmed)" value={s.skippedFirstDelivery} warn />
        )}
        <Stat label="Unmatched" value={s.unmatched} warn={s.unmatched > 0} />
        <Stat label="Ambiguous" value={s.ambiguous} warn={s.ambiguous > 0} />
        <Stat label="Invalid / dup" value={s.invalid} warn={s.invalid > 0} />
      </div>

      {isValidate && report.ambiguous.length > 0 && (
        <p style={{ color: "#b45309", fontSize: "0.82rem", margin: "0 0 0.75rem", padding: "0.5rem 0.65rem", background: "rgba(180,83,9,0.08)", borderRadius: "6px" }}>
          <strong>Ambiguous:</strong> {report.ambiguous.length} row{report.ambiguous.length === 1 ? "" : "s"} match more
          than one member. They are <strong>never</strong> imported automatically — fix the underlying member records
          (duplicate account / oil IDs on multiple members), then run the import again.
        </p>
      )}

      {isValidate && firstDeliveryMembers.length > 0 && (
        <FirstDeliveryConfirmTable
          members={firstDeliveryMembers}
          confirms={firstDeliveryConfirms}
          setConfirms={setFirstDeliveryConfirms}
        />
      )}

      {isValidate && unmatchedGroups.length > 0 && (
        <UnmatchedGroupConfirmTable
          groups={unmatchedGroups}
          decisions={createMemberDecisions}
          setDecisions={setCreateMemberDecisions}
        />
      )}

      {!isValidate && (report.createdMembers?.length ?? 0) > 0 && (
        <ReportTable
          title="New members created"
          rows={(report.createdMembers || []).map((c) => ({
            "Member #": c.memberNumber,
            Name: `${c.firstName} ${c.lastName}`.trim(),
          }))}
        />
      )}

      {!isValidate && (report.matchedExisting?.length ?? 0) > 0 && (
        <ReportTable
          title="Matched to existing members"
          rows={(report.matchedExisting || []).map((m) => ({
            "Member #": m.memberNumber,
            Name: m.memberName || "(unnamed)",
            Fuel: m.fuelType,
            Account: m.account,
            "Rows added": m.rowsAppended,
            "Account stamped": m.stampedAccount ? "yes" : "(already on file)",
          }))}
        />
      )}

      {report.unmatched.length > 0 && (
        <UnmatchedRowsDetailTable
          title={isValidate ? "Unmatched rows (needs follow-up)" : "Unmatched rows — discarded on Apply"}
          rows={report.unmatched}
          mode={mode}
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
          title="Invalid / duplicate / not imported"
          rows={report.errors.map((e) => ({
            "Row #": e.rowNumber,
            Reason: formatImportErrorReason(e.reason, e.detail),
            Detail: e.detail ? JSON.stringify(e.detail) : "",
          }))}
        />
      )}
    </div>
  );
}

function FirstDeliveryConfirmTable({
  members,
  confirms,
  setConfirms,
}: {
  members: FirstDeliveryMemberInfo[];
  confirms: Record<string, boolean>;
  setConfirms: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  const allChecked = members.every((m) => confirms[m.memberId]);
  return (
    <>
      <h3 style={{ margin: "0.5rem 0", fontSize: "0.9rem" }}>
        First-delivery confirmation ({members.length})
      </h3>
      <p style={{ color: "var(--admin-muted)", fontSize: "0.78rem", margin: "0 0 0.5rem" }}>
        These customers exist but have <strong>no prior delivery history</strong>. Confirm each one
        before their rows will be imported — Apply skips any that are left unchecked.
      </p>
      <div className="admin-table-wrap" style={{ marginBottom: "0.75rem", maxHeight: "320px", overflowY: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: "1%", whiteSpace: "nowrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setConfirms((prev) => {
                        const next = { ...prev };
                        for (const m of members) next[m.memberId] = v;
                        return next;
                      });
                    }}
                  />
                  All
                </label>
              </th>
              <th>Member #</th>
              <th>Name</th>
              <th>Rows in import</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.memberId}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Confirm first delivery for ${m.name || m.memberNumber}`}
                    checked={Boolean(confirms[m.memberId])}
                    onChange={(e) =>
                      setConfirms((prev) => ({ ...prev, [m.memberId]: e.target.checked }))
                    }
                  />
                </td>
                <td>{m.memberNumber || "—"}</td>
                <td>{m.name || "—"}</td>
                <td>{m.rowCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function UnmatchedGroupConfirmTable({
  groups,
  decisions,
  setDecisions,
}: {
  groups: UnmatchedGroupInfo[];
  decisions: Record<string, UnmatchedGroupDecision>;
  setDecisions: React.Dispatch<React.SetStateAction<Record<string, UnmatchedGroupDecision>>>;
}) {
  return (
    <>
      <h3 style={{ margin: "0.5rem 0", fontSize: "0.9rem" }}>
        Unrecognized customers ({groups.length})
      </h3>
      <p style={{ color: "var(--admin-muted)", fontSize: "0.78rem", margin: "0 0 0.5rem" }}>
        No member has these <strong>account / oil IDs</strong> on file. Choose one per group: <strong>Skip</strong>{" "}
        (default — these rows are <em>discarded</em>, not saved), <strong>Match to existing member</strong> (search by
        name or member #; the account is stamped onto their record so future imports auto-match), or{" "}
        <strong>Create new member</strong> (name pre-filled from the file).
      </p>
      <div className="admin-table-wrap" style={{ marginBottom: "0.75rem", maxHeight: "420px", overflowY: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ minWidth: "12rem" }}>Decision</th>
              <th>Fuel</th>
              <th>Company</th>
              <th>Account</th>
              <th>Hint</th>
              <th>Rows</th>
              <th colSpan={2}>Details</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const d =
                decisions[g.groupKey] || {
                  mode: "skip" as UnmatchedGroupMode,
                  firstName: "",
                  lastName: "",
                  matchMemberId: "",
                  matchMemberLabel: "",
                };
              const update = (patch: Partial<UnmatchedGroupDecision>) =>
                setDecisions((prev) => ({
                  ...prev,
                  [g.groupKey]: { ...d, ...patch },
                }));
              const nameMissing = d.mode === "create" && (!d.firstName.trim() || !d.lastName.trim());
              const matchMissing = d.mode === "match" && !d.matchMemberId.trim();
              return (
                <tr key={g.groupKey}>
                  <td>
                    <select
                      className="admin-input"
                      style={{ minWidth: "10rem", fontSize: "0.8rem" }}
                      value={d.mode}
                      onChange={(e) => update({ mode: e.target.value as UnmatchedGroupMode })}
                      aria-label={`Decision for ${g.account}`}
                    >
                      <option value="skip">Skip (discard rows)</option>
                      <option value="match">Match to existing member</option>
                      <option value="create">Create new member</option>
                    </select>
                  </td>
                  <td>{g.fuelType}</td>
                  <td>{g.companyName}</td>
                  <td>{g.account}</td>
                  <td style={{ maxWidth: "14rem", fontSize: "0.78rem" }} title={g.hint?.message}>
                    {g.hint?.message || "—"}
                  </td>
                  <td>{g.rowCount}</td>
                  <td colSpan={2}>
                    {d.mode === "create" ? (
                      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                        <input
                          className="admin-input"
                          style={{ minWidth: "7rem" }}
                          value={d.firstName}
                          onChange={(e) => update({ firstName: e.target.value })}
                          placeholder="First name"
                          aria-invalid={nameMissing && !d.firstName.trim() ? true : undefined}
                        />
                        <input
                          className="admin-input"
                          style={{ minWidth: "7rem" }}
                          value={d.lastName}
                          onChange={(e) => update({ lastName: e.target.value })}
                          placeholder="Last name"
                          aria-invalid={nameMissing && !d.lastName.trim() ? true : undefined}
                        />
                      </div>
                    ) : d.mode === "match" ? (
                      <MemberSearchPicker
                        value={d.matchMemberId}
                        label={d.matchMemberLabel}
                        invalid={matchMissing}
                        onPick={(memberId, memberLabel) =>
                          update({ matchMemberId: memberId, matchMemberLabel: memberLabel })
                        }
                        onClear={() => update({ matchMemberId: "", matchMemberLabel: "" })}
                      />
                    ) : (
                      <span style={{ color: "var(--admin-muted)", fontSize: "0.78rem" }}>
                        Rows for this group will be discarded on Apply.
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Inline async picker — types a query, debounces, calls /api/admin/members?q=. */
function MemberSearchPicker({
  value,
  label,
  invalid,
  onPick,
  onClear,
}: {
  value: string;
  label: string;
  invalid?: boolean;
  onPick: (memberId: string, label: string) => void;
  onClear: () => void;
}) {
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<
    Array<{ _id: string; memberNumber?: string; firstName?: string; lastName?: string; legacyProfile?: Record<string, unknown> }>
  >([]);

  useEffect(() => {
    if (!token) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const handle = window.setTimeout(async () => {
      setBusy(true);
      try {
        const r = await api<{
          members: Array<{
            _id: string;
            memberNumber?: string;
            firstName?: string;
            lastName?: string;
            legacyProfile?: Record<string, unknown>;
          }>;
        }>(`/api/admin/members?q=${encodeURIComponent(q)}`, { token, signal: ctrl.signal });
        setResults(r.members.slice(0, 8));
      } catch {
        // Aborted or failed — surface no results.
        setResults([]);
      } finally {
        setBusy(false);
      }
    }, 300);
    return () => {
      ctrl.abort();
      window.clearTimeout(handle);
    };
  }, [query, token]);

  if (value) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.82rem" }}>{label || `Member ${value}`}</span>
        <button
          type="button"
          className="admin-btn"
          style={{ fontSize: "0.72rem", padding: "0.15rem 0.45rem" }}
          onClick={() => {
            onClear();
            setQuery("");
            setOpen(true);
          }}
        >
          Change
        </button>
      </div>
    );
  }
  return (
    <div style={{ position: "relative" }}>
      <input
        className="admin-input"
        style={{ minWidth: "16rem", fontSize: "0.8rem" }}
        value={query}
        placeholder="Search name, member #, email…"
        aria-invalid={invalid ? true : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
      />
      {open && query.trim().length >= 2 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 10,
            background: "var(--admin-card-bg, #fff)",
            border: "1px solid var(--admin-border, #d4d6d9)",
            borderRadius: "4px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            maxHeight: "220px",
            overflowY: "auto",
            fontSize: "0.8rem",
          }}
        >
          {busy && (
            <div style={{ padding: "0.4rem 0.6rem", color: "var(--admin-muted)" }}>Searching…</div>
          )}
          {!busy && results.length === 0 && (
            <div style={{ padding: "0.4rem 0.6rem", color: "var(--admin-muted)" }}>No matches.</div>
          )}
          {results.map((m) => {
            const lp = (m.legacyProfile || {}) as Record<string, unknown>;
            const name = `${m.firstName || ""} ${m.lastName || ""}`.trim() || "(unnamed)";
            const oilId = String(lp.oilId || "");
            const propaneId = String(lp.propaneId || "");
            const idHint = [oilId && `oil ${oilId}`, propaneId && `propane ${propaneId}`].filter(Boolean).join(", ");
            const label = `${name} (${m.memberNumber || "—"})${idHint ? ` — ${idHint}` : ""}`;
            return (
              <button
                key={m._id}
                type="button"
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "0.35rem 0.6rem",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(m._id, label);
                  setQuery("");
                  setOpen(false);
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
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
