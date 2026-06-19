import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../api";
import { useAuth } from "../authContext";

type OilCompany = { _id: string; name: string; active?: boolean };
const CUSTOM_COMPANY = "__custom__";

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

const STANDARD_SIX_FIELDS: SemanticField[] = [
  "month",
  "fuelType",
  "account",
  "name",
  "gallons",
  "ignore",
];

const MAX_IMPORT_COLUMNS = 40;

function importColKey(columnIndex: number): string {
  return `__c${columnIndex}`;
}

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
  allHeaders: string[];
  headers: string[];
  rows: Array<Record<string, unknown>>;
  rowCellsWide: unknown[][];
  fullColumnCount: number;
};

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

function gridMaxColumns(grid: unknown[][]): number {
  let w = 0;
  for (const row of grid) {
    if (Array.isArray(row) && row.length > w) w = row.length;
  }
  return w;
}

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
type CreateMemberDecision = UnmatchedGroupDecision;

const FIELD_LABELS: Record<SemanticField, string> = {
  fuelType: "Fuel type (OIL / PROP / PROPANE)",
  account: "Account # — used to match customers",
  companyName: "Company name (optional)",
  dateDelivered: "Date delivered",
  month: "Month — pair with Year column",
  year: "Year — pair with Month column",
  gallons: "Gallons",
  name: "Customer name (reference only)",
  nameFirst: "First name",
  nameLast: "Last name",
  address: "Service address (reference only)",
  ignore: "Ignore this column",
};

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

function parseMonthCell(raw: string): number | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  const numLead = s.match(/^\d{1,2}/);
  if (numLead) {
    const n = Number(numLead[0]);
    if (n >= 1 && n <= 12) return n;
  }
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
  { key: "account", label: "Account #" },
  { key: "fuelType", label: "Fuel" },
  { key: "dateDelivered", label: "Date" },
  { key: "gallons", label: "Gallons" },
];

function importPreviewColumnsForMapping(map: SemanticField[]): { key: keyof ImportPayloadRow; label: string }[] {
  const cols = [...IMPORT_PAYLOAD_PREVIEW_COLUMNS];
  const has = (f: SemanticField) => map.includes(f);
  if (has("name") || has("nameFirst") || has("nameLast")) {
    cols.push({ key: "name", label: "Customer name" });
  }
  if (has("companyName")) cols.push({ key: "companyName", label: "Company" });
  if (has("address")) cols.push({ key: "address", label: "Address" });
  return cols;
}

function formatImportPreviewCell(row: ImportPayloadRow, key: keyof ImportPayloadRow): string {
  const v = row[key];
  if (v == null || v === "") return "—";
  return String(v);
}

type ImportHistoryItem = {
  importBatchId: string;
  fileName: string;
  totalRows: number;
  appended: number;
  createdMembers: number;
  unmatched: number;
  createdAt: string;
};

function splitSuggestedName(raw: string): { firstName: string; lastName: string } {
  const s = String(raw || "").trim();
  if (!s) return { firstName: "", lastName: "" };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

// ── Draft persistence ────────────────────────────────────────────────────────

const DRAFT_KEY = "delivery-import-draft-v1";

type ImportDraft = {
  fileName: string;
  sheet: ParsedSheet | null;
  columnMapping: SemanticField[];
  defaults: { fuelType: "" | "OIL" | "PROP" | "PROPANE"; companySelection: string; customCompanyName: string };
  report: ServerImportResponse | null;
  reportMode: "validate" | "apply" | null;
  firstDeliveryConfirms: Record<string, boolean>;
  createMemberDecisions: Record<string, CreateMemberDecision>;
  confirmedFirstDeliveryMembers: FirstDeliveryMemberInfo[];
};

function loadDraft(): Partial<ImportDraft> {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<ImportDraft>;
  } catch {
    return {};
  }
}

function saveDraft(draft: Partial<ImportDraft>): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage quota exceeded or unavailable — silently ignore
  }
}

function clearDraft(): void {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

// ────────────────────────────────────────────────────────────────────────────

export default function AdminDeliveryImportPage() {
  const { token } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string>(() => loadDraft().fileName ?? "");
  const [sheet, setSheet] = useState<ParsedSheet | null>(() => loadDraft().sheet ?? null);
  const [columnMapping, setColumnMapping] = useState<SemanticField[]>(() => loadDraft().columnMapping ?? [...STANDARD_SIX_FIELDS]);
  const [defaults, setDefaults] = useState(() => loadDraft().defaults ?? {
    fuelType: "" as "" | "OIL" | "PROP" | "PROPANE",
    companySelection: "",
    customCompanyName: "",
  });
  const [oilCompanies, setOilCompanies] = useState<OilCompany[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ServerImportResponse | null>(() => loadDraft().report ?? null);
  const [reportMode, setReportMode] = useState<"validate" | "apply" | null>(() => loadDraft().reportMode ?? null);

  const [firstDeliveryConfirms, setFirstDeliveryConfirms] = useState<Record<string, boolean>>(() => loadDraft().firstDeliveryConfirms ?? {});
  const [createMemberDecisions, setCreateMemberDecisions] = useState<Record<string, CreateMemberDecision>>(() => loadDraft().createMemberDecisions ?? {});
  const [confirmedFirstDeliveryMembers, setConfirmedFirstDeliveryMembers] = useState<FirstDeliveryMemberInfo[]>(() => loadDraft().confirmedFirstDeliveryMembers ?? []);

  // Persist draft whenever any import state changes so navigation doesn't lose progress
  useEffect(() => {
    saveDraft({ fileName, sheet, columnMapping, defaults, report, reportMode, firstDeliveryConfirms, createMemberDecisions, confirmedFirstDeliveryMembers });
  }, [fileName, sheet, columnMapping, defaults, report, reportMode, firstDeliveryConfirms, createMemberDecisions, confirmedFirstDeliveryMembers]);

  const [importHistory, setImportHistory] = useState<ImportHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [undoingBatchId, setUndoingBatchId] = useState<string | null>(null);
  const [undoResult, setUndoResult] = useState<{ batchId: string; rowsRemoved: number; membersAffected: number } | null>(null);

  function loadHistory() {
    if (!token) return;
    setHistoryLoading(true);
    api<{ imports: ImportHistoryItem[] }>("/api/admin/deliveries/import-history", { token })
      .then((r) => setImportHistory(r.imports))
      .catch(() => setImportHistory([]))
      .finally(() => setHistoryLoading(false));
  }

  useEffect(() => {
    loadHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleUndo(batchId: string, fileName: string) {
    if (!token) return;
    if (!window.confirm(`Undo this import?\n\nFile: ${fileName || batchId}\n\nThis will remove all delivery rows that were added in this import. This cannot be undone.`)) return;
    setUndoingBatchId(batchId);
    try {
      const r = await api<{ ok: boolean; rowsRemoved: number; membersAffected: number }>(
        `/api/admin/deliveries/import/${encodeURIComponent(batchId)}/undo`,
        { method: "POST", token, body: JSON.stringify({}) }
      );
      setUndoResult({ batchId, rowsRemoved: r.rowsRemoved, membersAffected: r.membersAffected });
      setImportHistory((prev) => prev.filter((i) => i.importBatchId !== batchId));
    } catch {
      alert("Undo failed — please try again.");
    } finally {
      setUndoingBatchId(null);
    }
  }

  useEffect(() => {
    if (!token) return;
    api<{ oilCompanies: OilCompany[] }>("/api/admin/oil-companies?includeInactive=1", { token })
      .then((r) => setOilCompanies([...r.oilCompanies].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setOilCompanies([]));
  }, [token]);

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
          setParseError("No data found in the file. Make sure the file has rows of data below the header row.");
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
        setParseError(err instanceof Error ? err.message : "Failed to read file");
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
      if (n > 1) mappingErrors.push(`"${FIELD_LABELS[field]}" is assigned to more than one column — please pick it only once.`);
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
      if (!cols.account) missingFields.push("Account #");
      if (dateMode === "none") missingFields.push("Date (or Month + Year)");
      if (!cols.gallons) missingFields.push("Gallons");
      if (!cols.fuelType && !defaults.fuelType) missingFields.push("Fuel type");
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
    const confirmedSnapshot = dryRun
      ? []
      : (report?.firstDeliveryMembers || []).filter((m) => firstDeliveryConfirms[m.memberId]);
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
      if (!dryRun) setConfirmedFirstDeliveryMembers(confirmedSnapshot);
      if (dryRun) {
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
    clearDraft();
    setFileName("");
    setSheet(null);
    setReport(null);
    setReportMode(null);
    setParseError(null);
    setDefaults({ fuelType: "", companySelection: "", customCompanyName: "" });
    setColumnMapping([...STANDARD_SIX_FIELDS]);
    setFirstDeliveryConfirms({});
    setCreateMemberDecisions({});
    setConfirmedFirstDeliveryMembers([]);
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
        <h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 600 }}>Import Delivery History</h1>
        {sheet && (
          <button type="button" className="admin-btn" onClick={reset}>
            Start over
          </button>
        )}
      </div>
      <p style={{ color: "var(--admin-muted)", fontSize: "0.875rem", margin: "0.25rem 0 1.25rem" }}>
        Upload a monthly delivery file from your oil company. The system matches each row to a customer by their account number and adds the delivery to their record.
      </p>

      {/* Step 1 */}
      <div className="admin-card">
        <h2>1. Choose file</h2>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          onChange={handlePickFile}
          style={{ display: "block", marginBottom: "0.5rem" }}
        />
        {fileName && (
          <p style={{ margin: 0, color: "var(--admin-muted)", fontSize: "0.85rem" }}>
            <strong>{fileName}</strong>
            {sheet ? ` — ${sheet.rows.length} row${sheet.rows.length === 1 ? "" : "s"} found` : ""}
          </p>
        )}
        {parseError && <p style={{ color: "#b91c1c", fontSize: "0.85rem", marginTop: "0.5rem" }}>{parseError}</p>}
      </div>

      {/* Import history */}
      <ImportHistoryPanel
        history={importHistory}
        loading={historyLoading}
        undoingBatchId={undoingBatchId}
        undoResult={undoResult}
        onUndo={handleUndo}
        onDismissResult={() => setUndoResult(null)}
      />

      {sheet && sheet.rows.length > 0 && (
        <>
          {/* Step 2 */}
          <div className="admin-card">
            <h2>2. Match columns</h2>
            <p style={{ color: "var(--admin-muted)", fontSize: "0.8rem", marginTop: 0, marginBottom: "0.75rem" }}>
              Tell the system what each column contains. The most common format is auto-detected — you usually don't need to change anything here.
            </p>

            {sheet.fullColumnCount > MAX_IMPORT_COLUMNS && (
              <p style={{ color: "#b45309", fontSize: "0.8rem", margin: "0 0 0.5rem" }}>
                This file has <strong>{sheet.fullColumnCount}</strong> columns; only the first{" "}
                <strong>{MAX_IMPORT_COLUMNS}</strong> are loaded.
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
                Reset to defaults
              </button>
            </p>

            <div className="admin-table-wrap" style={{ marginBottom: "0.75rem" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Column</th>
                    <th>Column header in file</th>
                    <th>What it contains</th>
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
                          aria-label={`Column ${columnIndexToLetter(i)}`}
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
                    Fuel type — applies to every row
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
                    <option value="">— select fuel type —</option>
                    <option value="OIL">OIL</option>
                    <option value="PROP">PROP</option>
                    <option value="PROPANE">PROPANE</option>
                  </select>
                  <p style={{ color: "var(--admin-muted)", fontSize: "0.72rem", margin: "0.25rem 0 0" }}>
                    Set this if all rows in the file are the same fuel type and no column lists it.
                  </p>
                </div>
              )}
            </div>

            {builtRows.mappingErrors.length > 0 && (
              <ul style={{ color: "#b91c1c", fontSize: "0.85rem", margin: "0.75rem 0 0", paddingLeft: "1.25rem" }}>
                {builtRows.mappingErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
            {builtRows.missingFields.length > 0 && (
              <p style={{ color: "#b45309", fontSize: "0.85rem", margin: "0.75rem 0 0" }}>
                Still needed before you can import: {builtRows.missingFields.join(", ")}
              </p>
            )}
          </div>

          {/* Step 3 */}
          <div className="admin-card">
            <h2>3. Preview ({importPreviewRows.length} of {sheet.rows.length} rows)</h2>
            <p style={{ color: "var(--admin-muted)", fontSize: "0.75rem", margin: "-0.25rem 0 0.5rem" }}>
              This is a sample of what will be imported based on your column settings above.
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

          {/* Step 4 */}
          <div className="admin-card">
            <h2>4. Check &amp; save</h2>
            <p style={{ color: "var(--admin-muted)", fontSize: "0.8rem", marginTop: 0 }}>
              <strong>Check first</strong> runs through the file without saving anything — it shows you which customers were found, which weren't, and anything that needs your attention.{" "}
              <strong>Save deliveries</strong> writes the records to each customer's history.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="admin-btn"
                onClick={() => void postImport(true)}
                disabled={!canRun || busy}
              >
                {busy && reportMode === "validate" ? "Checking…" : "Check first (no changes)"}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={() => void postImport(false)}
                disabled={!canRun || busy}
              >
                {busy && reportMode === "apply" ? "Saving…" : "Save deliveries"}
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
          confirmedFirstDeliveryMembers={confirmedFirstDeliveryMembers}
          onRevalidate={sheet && builtRows.rows.length > 0 ? () => void postImport(true) : undefined}
          busy={busy}
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
  confirmedFirstDeliveryMembers: FirstDeliveryMemberInfo[];
  onRevalidate?: () => void;
  busy?: boolean;
};

function formatImportErrorReason(reason: string, detail?: Record<string, unknown>): string {
  if (reason === "ambiguous_not_imported") {
    const ids = Array.isArray(detail?.candidateMemberIds)
      ? (detail.candidateMemberIds as string[]).join(", ")
      : "";
    return `This account number is linked to more than one customer — not imported. Please fix the duplicate on the customer records, then re-import. Customer IDs: ${ids || "(none)"}`;
  }
  if (reason === "duplicate_skipped") return "Already saved — skipped.";
  return reason;
}

function ImportReportCard({
  report,
  mode,
  firstDeliveryConfirms,
  setFirstDeliveryConfirms,
  createMemberDecisions,
  setCreateMemberDecisions,
  confirmedFirstDeliveryMembers,
  onRevalidate,
  busy,
}: ImportReportCardProps) {
  const s = report.summary;
  const firstDeliveryMembers = report.firstDeliveryMembers || [];
  const unmatchedGroups = report.unmatchedGroups || [];
  const isValidate = mode === "validate";
  const hasUnresolved = !isValidate && (s.unmatched > 0 || (s.skippedFirstDelivery ?? 0) > 0);
  const [fdTab, setFdTab] = useState<"pending" | "confirmed">("pending");

  useEffect(() => {
    if (!isValidate && confirmedFirstDeliveryMembers.length > 0) setFdTab("confirmed");
  }, [isValidate, confirmedFirstDeliveryMembers.length]);

  return (
    <div className="admin-card">
      <h2>{isValidate ? "Check results" : "Import complete"}</h2>
      {hasUnresolved && onRevalidate && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", padding: "0.6rem 0.75rem", marginBottom: "0.85rem", background: "rgba(180,83,9,0.08)", border: "1px solid rgba(180,83,9,0.3)", borderRadius: "6px" }}>
          <div style={{ fontSize: "0.82rem", color: "#92400e" }}>
            <strong>{s.unmatched + (s.skippedFirstDelivery ?? 0)} row{s.unmatched + (s.skippedFirstDelivery ?? 0) === 1 ? "" : "s"} still need attention.</strong>{" "}
            Fix more customer records, then click <strong>Check again</strong> to pick up where you left off. The file stays loaded — you can leave and come back later.
          </div>
          <button
            type="button"
            className="admin-btn"
            onClick={onRevalidate}
            disabled={busy}
            style={{ whiteSpace: "nowrap" }}
          >
            {busy ? "Checking…" : "Check again"}
          </button>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.5rem", marginBottom: "1rem" }}>
        <Stat label="Total rows" value={s.totalRows} />
        <Stat label="Customers found" value={s.matched} ok />
        {s.appended != null && <Stat label="Deliveries saved" value={s.appended} ok />}
        {firstDeliveryMembers.length > 0 && (
          <Stat
            label="Need confirmation"
            value={firstDeliveryMembers.length}
            warn
            onClick={() => document.getElementById("first-delivery-section")?.scrollIntoView({ behavior: "smooth" })}
          />
        )}
        {s.createdMembers != null && s.createdMembers > 0 && (
          <Stat label="New customers added" value={s.createdMembers} ok />
        )}
        {s.matchedExistingGroups != null && s.matchedExistingGroups > 0 && (
          <Stat label="Linked to existing" value={s.matchedExistingGroups} ok />
        )}
        <Stat label="Not found" value={s.unmatched} warn={s.unmatched > 0} />
        <Stat label="Duplicate accounts" value={s.ambiguous} warn={s.ambiguous > 0} />
        <Stat label="Skipped / already saved" value={s.invalid} warn={s.invalid > 0} />
      </div>

      {isValidate && report.ambiguous.length > 0 && (
        <p style={{ color: "#b45309", fontSize: "0.82rem", margin: "0 0 0.75rem", padding: "0.5rem 0.65rem", background: "rgba(180,83,9,0.08)", borderRadius: "6px" }}>
          <strong>Duplicate account numbers:</strong> {report.ambiguous.length} row{report.ambiguous.length === 1 ? "" : "s"} matched more than one customer and were <strong>not saved</strong>. Please fix the duplicate account numbers on the affected customer records, then run the import again.
        </p>
      )}

      {isValidate && unmatchedGroups.length > 0 && (
        <UnmatchedGroupConfirmTable
          groups={unmatchedGroups}
          decisions={createMemberDecisions}
          setDecisions={setCreateMemberDecisions}
        />
      )}

      {(isValidate && firstDeliveryMembers.length > 0) || confirmedFirstDeliveryMembers.length > 0 ? (
        <div id="first-delivery-section">
          <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--wb-border)", marginBottom: "0.75rem" }}>
            {isValidate && firstDeliveryMembers.length > 0 && (
              <button
                type="button"
                onClick={() => setFdTab("pending")}
                style={{ padding: "0.35rem 0.85rem", fontSize: "0.82rem", fontWeight: 600, border: "none", borderBottom: fdTab === "pending" ? "2px solid var(--admin-primary, #b91c1c)" : "2px solid transparent", background: "none", cursor: "pointer", color: fdTab === "pending" ? "var(--admin-primary, #b91c1c)" : "inherit", marginBottom: "-2px" }}
              >
                Pending ({firstDeliveryMembers.length})
              </button>
            )}
            {confirmedFirstDeliveryMembers.length > 0 && (
              <button
                type="button"
                onClick={() => setFdTab("confirmed")}
                style={{ padding: "0.35rem 0.85rem", fontSize: "0.82rem", fontWeight: 600, border: "none", borderBottom: fdTab === "confirmed" ? "2px solid #15803d" : "2px solid transparent", background: "none", cursor: "pointer", color: fdTab === "confirmed" ? "#15803d" : "inherit", marginBottom: "-2px" }}
              >
                Confirmed ({confirmedFirstDeliveryMembers.length})
              </button>
            )}
          </div>
          {fdTab === "pending" && isValidate && firstDeliveryMembers.length > 0 && (
            <FirstDeliveryConfirmTable
              members={firstDeliveryMembers}
              confirms={firstDeliveryConfirms}
              setConfirms={setFirstDeliveryConfirms}
            />
          )}
          {fdTab === "confirmed" && confirmedFirstDeliveryMembers.length > 0 && (
            <ConfirmedFirstDeliveryTable members={confirmedFirstDeliveryMembers} />
          )}
        </div>
      ) : null}

      {!isValidate && (report.createdMembers?.length ?? 0) > 0 && (
        <ReportTable
          title="New customers created"
          rows={(report.createdMembers || []).map((c) => ({
            "Member #": c.memberNumber,
            Name: `${c.firstName} ${c.lastName}`.trim(),
          }))}
        />
      )}

      {!isValidate && (report.matchedExisting?.length ?? 0) > 0 && (
        <ReportTable
          title="Linked to existing customers"
          rows={(report.matchedExisting || []).map((m) => ({
            "Member #": m.memberNumber,
            Name: m.memberName || "(unnamed)",
            Fuel: m.fuelType,
            "Account #": m.account,
            "Rows added": m.rowsAppended,
            "Account saved": m.stampedAccount ? "yes" : "(already on file)",
          }))}
        />
      )}

      {report.ambiguous.length > 0 && (
        <ReportTable
          title="Duplicate account numbers — not imported"
          rows={report.ambiguous.map((a) => ({
            "Row #": a.rowNumber,
            Company: a.companyName,
            "Account #": a.account,
            "Affected customer IDs": a.candidateMemberIds.join(", "),
          }))}
        />
      )}

      {report.errors.length > 0 && (
        <ReportTable
          title="Skipped rows"
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

function ConfirmedFirstDeliveryTable({ members }: { members: FirstDeliveryMemberInfo[] }) {
  return (
    <>
      <p style={{ color: "var(--admin-muted)", fontSize: "0.78rem", margin: "0 0 0.5rem" }}>
        Deliveries for these customers were saved successfully.
      </p>
      <div className="admin-table-wrap" style={{ marginBottom: "0.75rem", maxHeight: "320px", overflowY: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Member #</th>
              <th>Customer name</th>
              <th>Deliveries saved</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.memberId}>
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
      <p style={{ color: "var(--admin-muted)", fontSize: "0.78rem", margin: "0 0 0.5rem" }}>
        These customers are in the system but have <strong>no delivery history yet</strong>. Check the box next to each one to include their deliveries when you click <strong>Save deliveries</strong>. Unchecked customers will be skipped.
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
              <th>Customer name</th>
              <th>Deliveries in file</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.memberId}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Include deliveries for ${m.name || m.memberNumber}`}
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
        Customers not found ({groups.length})
      </h3>
      <p style={{ color: "var(--admin-muted)", fontSize: "0.78rem", margin: "0 0 0.5rem" }}>
        No customer record was found for these account numbers. For each one, choose what to do:{" "}
        <strong>Skip</strong> (don't save — the rows are discarded),{" "}
        <strong>Link to existing customer</strong> (search and attach; the account number will be saved so future imports match automatically), or{" "}
        <strong>Create new customer</strong> (adds a new record using the name from the file).
      </p>
      <div className="admin-table-wrap" style={{ marginBottom: "0.75rem", maxHeight: "420px", overflowY: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ minWidth: "14rem" }}>Action</th>
              <th>Last Name</th>
              <th>First Name</th>
              <th>Acct #</th>
              <th>Fuel</th>
              <th>Details</th>
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
              const suggested = splitSuggestedName(g.suggestedName);
              return (
                <tr key={g.groupKey}>
                  <td>
                    <select
                      className="admin-input"
                      style={{ minWidth: "12rem", fontSize: "0.8rem" }}
                      value={d.mode}
                      onChange={(e) => update({ mode: e.target.value as UnmatchedGroupMode })}
                      aria-label={`Action for account ${g.account}`}
                    >
                      <option value="skip">Skip (discard rows)</option>
                      <option value="match">Link to existing customer</option>
                      <option value="create">Create new customer</option>
                    </select>
                  </td>
                  <td>{suggested.lastName || "—"}</td>
                  <td>{suggested.firstName || "—"}</td>
                  <td>{g.account}</td>
                  <td>{g.fuelType}</td>
                  <td>
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
                        These rows will not be saved.
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
        <span style={{ fontSize: "0.82rem" }}>{label || `Customer ${value}`}</span>
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
        placeholder="Search by name or member #…"
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
            <div style={{ padding: "0.4rem 0.6rem", color: "var(--admin-muted)" }}>No matches found.</div>
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

function ImportHistoryPanel({
  history,
  loading,
  undoingBatchId,
  undoResult,
  onUndo,
  onDismissResult,
}: {
  history: ImportHistoryItem[];
  loading: boolean;
  undoingBatchId: string | null;
  undoResult: { batchId: string; rowsRemoved: number; membersAffected: number } | null;
  onUndo: (batchId: string, fileName: string) => void;
  onDismissResult: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (loading && history.length === 0) return null;
  if (!loading && history.length === 0 && !undoResult) return null;

  return (
    <div className="admin-card" style={{ marginBottom: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Previous imports</h2>
        {history.length > 3 && (
          <button
            type="button"
            className="admin-btn"
            style={{ fontSize: "0.8rem", padding: "0.2rem 0.55rem" }}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Show less" : `Show all ${history.length}`}
          </button>
        )}
      </div>

      {undoResult && (
        <div style={{ margin: "0.75rem 0 0", padding: "0.6rem 0.75rem", background: "rgba(21,128,61,0.08)", border: "1px solid rgba(21,128,61,0.25)", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.85rem", color: "#15803d" }}>
            <strong>Undone.</strong> Removed {undoResult.rowsRemoved} delivery row{undoResult.rowsRemoved === 1 ? "" : "s"} from {undoResult.membersAffected} customer{undoResult.membersAffected === 1 ? "" : "s"}.
          </span>
          <button type="button" className="admin-btn" style={{ fontSize: "0.75rem", padding: "0.15rem 0.4rem" }} onClick={onDismissResult}>Dismiss</button>
        </div>
      )}

      {history.length === 0 && !loading ? null : (
        <div className="admin-table-wrap" style={{ marginTop: "0.75rem" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>File</th>
                <th>Rows saved</th>
                <th>New customers</th>
                <th>Not found</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(expanded ? history : history.slice(0, 3)).map((item) => {
                const isUndoing = undoingBatchId === item.importBatchId;
                const date = item.createdAt
                  ? new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "—";
                return (
                  <tr key={item.importBatchId}>
                    <td style={{ whiteSpace: "nowrap", fontSize: "0.85rem" }}>{date}</td>
                    <td style={{ fontSize: "0.85rem", maxWidth: "16rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.fileName}>
                      {item.fileName || <span style={{ color: "var(--admin-muted)" }}>—</span>}
                    </td>
                    <td style={{ fontSize: "0.85rem" }}>{item.appended}</td>
                    <td style={{ fontSize: "0.85rem" }}>{item.createdMembers || 0}</td>
                    <td style={{ fontSize: "0.85rem", color: item.unmatched > 0 ? "#b45309" : undefined }}>
                      {item.unmatched || 0}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-btn"
                        style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", color: "#b91c1c", borderColor: "#fca5a5" }}
                        disabled={isUndoing || undoingBatchId !== null}
                        onClick={() => onUndo(item.importBatchId, item.fileName)}
                      >
                        {isUndoing ? "Undoing…" : "Undo"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, ok, warn, onClick }: { label: string; value: number; ok?: boolean; warn?: boolean; onClick?: () => void }) {
  const color = ok ? "#15803d" : warn ? "#b45309" : "var(--admin-text)";
  return (
    <div
      className="admin-stat"
      style={{ padding: "0.5rem 0.75rem", cursor: onClick ? "pointer" : undefined }}
      onClick={onClick}
      title={onClick ? `Go to ${label}` : undefined}
    >
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
