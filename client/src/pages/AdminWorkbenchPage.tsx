import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../authContext";
import DeliveryHistoryModal from "../components/DeliveryHistoryModal";
import PaymentHistoryView from "../components/PaymentHistoryView";
import {
  MemberFilterWidget,
  buildFilterFields,
  decodeFilters,
  encodeFilters,
  evaluateFilter,
  type MemberFilter,
} from "../components/MemberFilterWidget";
import { exactStateMatch, stateSynonyms } from "../utils/stateAbbreviations";
import { formatPhoneValue } from "../utils/phone";
import PaymentFindModal from "../components/PaymentFindModal";
import { type InvoiceMember } from "../utils/invoice";
import { downloadMembershipInvoicePdf } from "../utils/invoicePdf";
import { LETTER_ORG, plainTextToEmailMiddle, previewPopupDocument, wrapEmailPreview, wrapLetterPreview, letterContextFromMember } from "../utils/emailPreview";
import RichEmailEditor, { htmlToPlainText } from "../components/RichEmailEditor";
import {
  applyTemplateVariables,
  orderedTemplateKeys,
  parseOilCompanyNotes,
  type EmailTemplateInfo,
} from "../utils/emailTemplateUtils";

const tabs = [
  "Data Entry",
  "Worksheet",
  "PAYMENT HISTORY",
  "MAILINGS",
  "PRINT FULL RECORD",
  "RUN BACKUP",
  "OIL CO FORM",
  "REFERRALS BY MEMBER",
  "MEMBERS LIST",
  "MEMBER STATUS RPT",
  "REFUND LETTER",
  "START DATE LETTER",
  "Multiple Referral Letter",
  "Renewal Mailing",
  "Prospective Mailing",
] as const;
type TabName = (typeof tabs)[number];

type Member = {
  _id: string;
  memberNumber?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  status: "active" | "expired" | "cancelled";
  notes?: string;
  notesHistory?: NoteEntry[];
  createdAt?: string;
  oilCompanyId?: { _id: string; name: string } | null;
  legacyProfile?: Record<string, unknown>;
};

type OilCompany = { _id: string; name: string; contactEmail?: string; contactPhone?: string; notes?: string; active?: boolean };
type PropaneCompany = { name: string; count?: number };
type BillingEvent = {
  _id: string;
  kind: string;
  status: string;
  amountCents: number;
  billingYear?: number;
  createdAt: string;
  manualEntry?: boolean;
  paymentMethod?: string;
  checkNumber?: string;
  entryType?: string;
  paidDate?: string | null;
};
type Comm = { _id: string; channel: string; subject?: string; status: string; createdAt: string };
type ReferralPerson = { firstName?: string; lastName?: string; email?: string; memberNumber?: string };
type Referral = { referrerMemberId?: ReferralPerson };
type ReferralMade = { _id: string; creditedAt?: string; newMemberId?: ReferralPerson };
type NoteEntry = { _id?: string; text: string; createdAt: string; createdBy: string };
type DeliveryHistoryRow = {
  _id?: string;
  dateDelivered: string;
  deliveryYear: number;
  fuelType: "OIL" | "PROPANE";
  gallons: number;
  source?: "manual" | "import" | "legacy";
};

type BackupHistoryEntry = {
  id: string;
  at: string;
  type: "manual" | "scheduled";
  location: string;
  sizeBytes: number;
};

function defaultWorkbenchMemberStatus(m: Member): string {
  const lp = (m.legacyProfile || {}) as Record<string, unknown>;
  const stored = lp.workbenchMemberStatus;
  if (typeof stored === "string" && stored.length > 0) return stored;
  if (m.status === "expired") return "INACTIVE";
  if (m.status === "cancelled") return "CANCELLED";
  if ((m.notes || "").toLowerCase().includes("prospect")) return "PROSPECTIVE";
  return "ACTIVE";
}

function workbenchStatusToApiStatus(ws: string): Member["status"] {
  if (ws === "INACTIVE") return "expired";
  if (ws === "CANCELLED") return "cancelled";
  return "active";
}

const WB_OIL_STATUS = ["ACTIVE", "INACTIVE", "PROSPECTIVE", "RESIDENT", "NO OIL", "UNKNOWN"] as const;
const WB_PROPANE_STATUS = ["ACTIVE", "INACTIVE", "PROSPECTIVE", "RESIDENT", "NO PROPANE", "UNKNOWN"] as const;
const ELECTRIC_STATUS = ["ELECTRIC", "PENDING", "INTERESTED", "UNKNOWN", "DROPPED"] as const;
const PHONE_TYPE = ["HOME", "WORK", "CELL"] as const;
const HOW_JOINED = ["WEB", "PHONE", "EVENT", "MAIL"] as const;
const REFERRAL_SOURCE = ["CCAG", "MEMBER", "OTHER"] as const;

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, "\"\"")}"` : s;
}

function fileNameStamp(now: Date = new Date()): string {
  return now.toISOString().replace(/[:.]/g, "-");
}

function escHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseDeliveryRows(raw: unknown): DeliveryHistoryRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const rec = row as Record<string, unknown>;
      const dateDelivered = String(rec.dateDelivered || "");
      const deliveryYear = Number(rec.deliveryYear);
      const fuelType = String(rec.fuelType || "OIL").toUpperCase();
      const gallons = Number(rec.gallons);
      if (!dateDelivered || !Number.isFinite(deliveryYear) || !Number.isFinite(gallons)) return null;
      if (fuelType !== "OIL" && fuelType !== "PROPANE") return null;
      return { dateDelivered, deliveryYear, fuelType, gallons };
    })
    .filter((v): v is DeliveryHistoryRow => Boolean(v))
    .sort((a, b) => {
      const ta = new Date(a.dateDelivered).getTime();
      const tb = new Date(b.dateDelivered).getTime();
      return tb - ta;
    });
}

export type WorkbenchFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  notes: string;
  oilCompanyId: string;
  legacyProfile: Record<string, unknown>;
};

function sortLegacyProfileKeys(lp: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(lp).sort()) out[k] = lp[k];
  return out;
}

function serializeWorkbenchForm(f: WorkbenchFormState): string {
  return JSON.stringify({
    firstName: f.firstName,
    lastName: f.lastName,
    email: f.email,
    phone: f.phone,
    addressLine1: f.addressLine1,
    addressLine2: f.addressLine2,
    city: f.city,
    state: f.state,
    postalCode: f.postalCode,
    notes: f.notes,
    oilCompanyId: f.oilCompanyId,
    legacyProfile: sortLegacyProfileKeys(f.legacyProfile || {}),
  });
}

function buildWorkbenchPatchBody(form: WorkbenchFormState) {
  const ws = String(form.legacyProfile.workbenchMemberStatus ?? "ACTIVE");
  const status = workbenchStatusToApiStatus(ws);
  const legacyProfile = { ...form.legacyProfile } as Record<string, unknown>;
  const newMemberDt = String(legacyProfile.newMemberDt ?? "").trim();
  if (newMemberDt) legacyProfile.oilStartDate = newMemberDt;
  return { ...form, legacyProfile, status };
}

function memberFromApiPatch(prev: Member, raw: Record<string, unknown>, oilCos: OilCompany[]): Member {
  const next: Member = {
    ...prev,
    _id: String(raw._id ?? prev._id),
    memberNumber: (raw.memberNumber as string | undefined) ?? prev.memberNumber,
    firstName: (raw.firstName as string) ?? prev.firstName,
    lastName: (raw.lastName as string) ?? prev.lastName,
    email: (raw.email as string) ?? prev.email,
    phone: (raw.phone as string | undefined) ?? prev.phone,
    addressLine1: (raw.addressLine1 as string | undefined) ?? prev.addressLine1,
    addressLine2: (raw.addressLine2 as string | undefined) ?? prev.addressLine2,
    city: (raw.city as string | undefined) ?? prev.city,
    state: (raw.state as string | undefined) ?? prev.state,
    postalCode: (raw.postalCode as string | undefined) ?? prev.postalCode,
    status: (raw.status as Member["status"]) ?? prev.status,
    notes: (raw.notes as string | undefined) ?? prev.notes,
    notesHistory: (raw.notesHistory as NoteEntry[] | undefined) ?? prev.notesHistory,
    createdAt: (raw.createdAt as string | undefined) ?? prev.createdAt,
    legacyProfile: (raw.legacyProfile as Record<string, unknown> | undefined) ?? prev.legacyProfile,
  };
  const oid = raw.oilCompanyId;
  if (oid == null || oid === "") next.oilCompanyId = null;
  else if (typeof oid === "string") {
    const oc = oilCos.find((o) => o._id === oid);
    next.oilCompanyId = oc ? { _id: oc._id, name: oc.name } : { _id: oid, name: prev.oilCompanyId?.name || "—" };
  } else if (typeof oid === "object" && oid && "name" in oid) {
    next.oilCompanyId = oid as { _id: string; name: string };
  }
  return next;
}

const WORKBENCH_AUTOSAVE_MS = 2200;

function oilCoCode(notes?: string): string {
  if (!notes) return "";
  const match = notes.split("|").map((p) => p.trim()).find((p) => p.startsWith("Code: "));
  return match ? match.slice(6).trim() : "";
}

const COLLAPSED_PANELS_KEY = "wb.collapsedPanels.v1";

function loadCollapsedPanels(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(COLLAPSED_PANELS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      const ids = arr.filter((v) => typeof v === "string") as string[];
      return new Set(ids);
    }
  } catch {
    // ignore corrupted storage
  }
  return new Set();
}

type WorksheetColumn = {
  key: string;
  label: string;
  group: string;
  get: (m: Member) => string;
};

const lpStr = (m: Member, key: string): string => {
  const v = (m.legacyProfile as Record<string, unknown> | undefined)?.[key];
  if (v === undefined || v === null || v === "") return "";
  if (typeof v === "boolean") return v ? "Yes" : "";
  return String(v);
};

const WORKSHEET_COLUMNS: WorksheetColumn[] = [
  { key: "memberNumber", label: "Member #", group: "Identity", get: (m) => m.memberNumber || "" },
  { key: "firstName", label: "First Name", group: "Identity", get: (m) => m.firstName || "" },
  { key: "lastName", label: "Last Name", group: "Identity", get: (m) => m.lastName || "" },
  { key: "name", label: "Full Name", group: "Identity", get: (m) => `${m.firstName || ""} ${m.lastName || ""}`.trim() },
  { key: "midName1", label: "Mid Name", group: "Identity", get: (m) => lpStr(m, "midName1") },
  { key: "suffix1", label: "Suffix", group: "Identity", get: (m) => lpStr(m, "suffix1") },
  { key: "firstName2", label: "Second First Name", group: "Identity", get: (m) => lpStr(m, "firstName2") },
  { key: "lastName2", label: "Second Last Name", group: "Identity", get: (m) => lpStr(m, "lastName2") },
  { key: "newMemberDt", label: "New Member Date", group: "Identity", get: (m) => lpStr(m, "newMemberDt") },
  { key: "originalStartDate", label: "Original Start Date", group: "Identity", get: (m) => lpStr(m, "originalStartDate") },
  { key: "standardMembership", label: "Standard Member", group: "Identity", get: (m) => lpStr(m, "standardMembership") },
  { key: "seniorMember", label: "Senior Member", group: "Identity", get: (m) => lpStr(m, "seniorMember") },
  { key: "lowVolume", label: "Low Volume", group: "Identity", get: (m) => lpStr(m, "lowVolume") },
  { key: "waiveFeeLifetime", label: "Lifetime Member", group: "Identity", get: (m) => lpStr(m, "waiveFeeLifetime") },

  { key: "address", label: "Address", group: "Address", get: (m) => [m.addressLine1, m.addressLine2].filter(Boolean).join(", ") },
  { key: "addressLine1", label: "Address 1", group: "Address", get: (m) => m.addressLine1 || "" },
  { key: "aptNo1", label: "Apt #", group: "Address", get: (m) => lpStr(m, "aptNo1") },
  { key: "mailAddr", label: "Mailing Address", group: "Address", get: (m) => lpStr(m, "mailAddr") },
  { key: "city", label: "City", group: "Address", get: (m) => m.city || "" },
  { key: "state", label: "State", group: "Address", get: (m) => m.state || "" },
  { key: "postalCode", label: "Zip", group: "Address", get: (m) => m.postalCode || "" },

  { key: "phone", label: "Phone 1", group: "Contact", get: (m) => m.phone || "" },
  { key: "phone2", label: "Phone 2", group: "Contact", get: (m) => lpStr(m, "phone2") },
  { key: "phone3", label: "Phone 3", group: "Contact", get: (m) => lpStr(m, "phone3") },
  { key: "email", label: "Email", group: "Contact", get: (m) => m.email || "" },
  { key: "email2", label: "Email 2", group: "Contact", get: (m) => lpStr(m, "email2") },
  { key: "emailOptOut", label: "Opted Out", group: "Contact", get: (m) => lpStr(m, "emailOptOut") },

  { key: "howJoined", label: "How Joined", group: "Status", get: (m) => lpStr(m, "howJoined") },
  { key: "referralSource", label: "Referral Source", group: "Status", get: (m) => lpStr(m, "referralSource") },
  { key: "referredById", label: "Referred By ID", group: "Status", get: (m) => lpStr(m, "referredById") },
  { key: "dateReferred", label: "Date Referred", group: "Status", get: (m) => lpStr(m, "dateReferred") },
  { key: "callBack", label: "Call Back", group: "Status", get: (m) => lpStr(m, "callBack") },
  { key: "callBackDate", label: "Call Back Date", group: "Status", get: (m) => lpStr(m, "callBackDate") },
  { key: "status", label: "Status", group: "Status", get: (m) => m.status || "" },

  { key: "oilCompany", label: "Oil Company", group: "Oil", get: (m) => m.oilCompanyId?.name || "" },
  { key: "oilId", label: "Oil ID", group: "Oil", get: (m) => lpStr(m, "oilId") },
  { key: "oilStartDate", label: "Oil Start Date", group: "Oil", get: (m) => lpStr(m, "oilStartDate") },
  { key: "oilWorkbenchStatus", label: "Oil Status", group: "Oil", get: (m) => lpStr(m, "oilWorkbenchStatus") },
  { key: "nrdOil", label: "NRD-Oil", group: "Oil", get: (m) => lpStr(m, "nrdOil") },

  { key: "propaneCompanyName", label: "Propane Company", group: "Propane", get: (m) => lpStr(m, "propaneCompanyName") },
  { key: "propaneId", label: "Propane ID", group: "Propane", get: (m) => lpStr(m, "propaneId") },
  { key: "propaneStartDate", label: "Propane Start Date", group: "Propane", get: (m) => lpStr(m, "propaneStartDate") },
  { key: "propaneStatus", label: "Propane Status", group: "Propane", get: (m) => lpStr(m, "propaneStatus") },
  { key: "nrdProp", label: "NRD-Prop", group: "Propane", get: (m) => lpStr(m, "nrdProp") },

  { key: "electricStatus", label: "Electric Status", group: "Electric", get: (m) => lpStr(m, "electricStatus") },
  { key: "electricSignUpDate", label: "Electric Sign Up Date", group: "Electric", get: (m) => lpStr(m, "electricSignUpDate") },
  { key: "electricStartDate", label: "Electric Start Date", group: "Electric", get: (m) => lpStr(m, "electricStartDate") },
  { key: "electricAccountNumber", label: "Electric Account #", group: "Electric", get: (m) => lpStr(m, "electricAccountNumber") },
  { key: "droppedDate", label: "Electric Dropped Date", group: "Electric", get: (m) => lpStr(m, "droppedDate") },
  { key: "delinquent", label: "Delinquent", group: "Electric", get: (m) => lpStr(m, "delinquent") },
  { key: "notPaidCurrentYr", label: "Not Paid Current Yr", group: "Electric", get: (m) => lpStr(m, "notPaidCurrentYr") },

  { key: "notes", label: "Notes", group: "Misc", get: (m) => m.notes || "" },
];

const WORKSHEET_COLUMN_KEYS = WORKSHEET_COLUMNS.map((c) => c.key);
const WORKSHEET_COLS_STORAGE_KEY = "workbench.worksheetColumns";

function loadWorksheetVisibleColumns(): string[] {
  try {
    const raw = localStorage.getItem(WORKSHEET_COLS_STORAGE_KEY);
    if (!raw) return WORKSHEET_COLUMN_KEYS;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return WORKSHEET_COLUMN_KEYS;
    const known = new Set(WORKSHEET_COLUMN_KEYS);
    const filtered = (parsed as unknown[]).filter((k): k is string => typeof k === "string" && known.has(k));
    return filtered.length > 0 ? filtered : WORKSHEET_COLUMN_KEYS;
  } catch {
    return WORKSHEET_COLUMN_KEYS;
  }
}

export default function AdminWorkbenchPage() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const memberParam = searchParams.get("member") ?? "";
  const missingMemberFetchAttempt = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>("Data Entry");
  const [members, setMembers] = useState<Member[]>([]);
  const [filters, setFilters] = useState<MemberFilter[]>(() => decodeFilters(searchParams.get("filters") || ""));
  const [quickSearch, setQuickSearch] = useState<string>(() => searchParams.get("q") || "");
  const [worksheetSort, setWorksheetSort] = useState<{ key: string; dir: "asc" | "desc" }>({
    key: "name",
    dir: "asc",
  });
  const [worksheetVisibleColumns, setWorksheetVisibleColumns] = useState<string[]>(() => loadWorksheetVisibleColumns());
  const [worksheetColumnPickerOpen, setWorksheetColumnPickerOpen] = useState(false);
  const [worksheetPage, setWorksheetPage] = useState(1);

  useEffect(() => {
    try {
      localStorage.setItem(WORKSHEET_COLS_STORAGE_KEY, JSON.stringify(worksheetVisibleColumns));
    } catch {
      /* ignore quota errors */
    }
  }, [worksheetVisibleColumns]);

  const activeWorksheetColumns = useMemo(() => {
    const visible = new Set(worksheetVisibleColumns);
    return WORKSHEET_COLUMNS.filter((c) => visible.has(c.key));
  }, [worksheetVisibleColumns]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [oilCompanies, setOilCompanies] = useState<OilCompany[]>([]);
  const [referralSources, setReferralSources] = useState<string[]>([...REFERRAL_SOURCE]);
  const [referralCustom, setReferralCustom] = useState("");
  const [referralCustomOpen, setReferralCustomOpen] = useState(false);
  const [propaneCompanies, setPropaneCompanies] = useState<PropaneCompany[]>([]);
  const [billing, setBilling] = useState<BillingEvent[]>([]);
  const [communications, setCommunications] = useState<Comm[]>([]);
  const [referral, setReferral] = useState<Referral | null>(null);
  const [referralsMade, setReferralsMade] = useState<ReferralMade[]>([]);
  const [referrerEditing, setReferrerEditing] = useState(false);
  const [referrerQuery, setReferrerQuery] = useState("");
  const [referrerSaving, setReferrerSaving] = useState(false);
  const [referrerError, setReferrerError] = useState("");

  // Oil Company editing state
  const [editingOilCo, setEditingOilCo] = useState<OilCompany | null>(null);
  const [oilCoForm, setOilCoForm] = useState({ name: "", contactEmail: "", contactPhone: "", notes: "" });
  const [showAddOilCo, setShowAddOilCo] = useState(false);

  // Notes state
  const [newNote, setNewNote] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [backupHistory, setBackupHistory] = useState<BackupHistoryEntry[]>([]);
  const [mailTemplateKey, setMailTemplateKey] = useState<string>("oilCompanyAssigned");
  const [mailSubject, setMailSubject] = useState<string>("");
  const [mailHtml, setMailHtml] = useState<string>("");
  const [mailText, setMailText] = useState<string>("");
  const [emailTemplates, setEmailTemplates] = useState<Record<string, EmailTemplateInfo> | null>(null);
  const [mailTemplatesLoading, setMailTemplatesLoading] = useState(false);
  // Only enabled templates are offered for a manual send (disabled = retired).
  const enabledMailTemplateKeys = useMemo(
    () => (emailTemplates ? orderedTemplateKeys(emailTemplates).filter((k) => emailTemplates[k]?.enabled !== false) : []),
    [emailTemplates]
  );
  const [emailMergeData, setEmailMergeData] = useState<Record<string, unknown> | null>(null);
  const [mailToEmail, setMailToEmail] = useState("");
  const [mailSending, setMailSending] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [paymentFindOpen, setPaymentFindOpen] = useState(false);
  // When set (from a Payment Find), bulk email targets these members instead of the current filter.
  const [bulkAudienceIds, setBulkAudienceIds] = useState<string[] | null>(null);
  const [deliveryHistoryOpen, setDeliveryHistoryOpen] = useState(false);

  const [collapsedPanels, setCollapsedPanels] = useState<Set<string>>(loadCollapsedPanels);

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_PANELS_KEY, JSON.stringify(Array.from(collapsedPanels)));
    } catch {
      // ignore quota errors
    }
  }, [collapsedPanels]);

  function togglePanel(id: string) {
    setCollapsedPanels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function panelHeader(id: string, title: string) {
    const collapsed = collapsedPanels.has(id);
    return (
      <button
        type="button"
        className="admin-wb-panel-title admin-wb-panel-toggle"
        aria-expanded={!collapsed}
        onClick={() => togglePanel(id)}
      >
        <span>{title}</span>
        <span className="admin-wb-collapse-chevron" aria-hidden="true">{collapsed ? "+" : "−"}</span>
      </button>
    );
  }

  const [form, setForm] = useState<WorkbenchFormState>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    notes: "",
    oilCompanyId: "",
    legacyProfile: {},
  });
  const formRef = useRef(form);
  formRef.current = form;
  const baselineSerializedRef = useRef("");
  const formAppliesToMemberIdRef = useRef<string | null>(null);
  const saveInFlightRef = useRef(false);
  const [saveToast, setSaveToast] = useState<{ message: string; ok: boolean } | null>(null);
  const saveToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveTick, setSaveTick] = useState(0);

  async function loadMembers() {
    if (!token) return;
    setLoading(true);
    try {
      const path = `/api/admin/members?all=1`;
      const { members: rows } = await api<{ members: Member[] }>(path, { token });
      setMembers(rows);
      setIndex(0);
    } finally {
      setLoading(false);
    }
  }

  async function loadOilCompanies() {
    if (!token) return;
    const { oilCompanies: rows } = await api<{ oilCompanies: OilCompany[] }>(
      "/api/admin/oil-companies?includeInactive=1",
      { token }
    );
    setOilCompanies(rows);
  }

  async function loadReferralSources() {
    if (!token) return;
    try {
      const { referralSources: rows } = await api<{ referralSources: string[] }>(
        "/api/admin/referral-sources",
        { token }
      );
      if (rows.length) setReferralSources(rows);
    } catch {
      // Non-fatal: fall back to the built-in defaults.
    }
  }

  // Persist a new referral option to the global list, then return its
  // canonical value (existing options are reused case-insensitively).
  async function addReferralSource(raw: string): Promise<string | null> {
    const value = raw.trim();
    if (!token || !value) return null;
    try {
      const { value: saved } = await api<{ value: string }>("/api/admin/referral-sources", {
        method: "POST",
        token,
        body: JSON.stringify({ value }),
      });
      await loadReferralSources();
      return saved;
    } catch {
      return null;
    }
  }

  // Admin correction: set / change / clear who referred the current member.
  async function saveReferrer(referrerMemberId: string | null) {
    if (!token || !current) return;
    setReferrerSaving(true);
    setReferrerError("");
    try {
      const r = await api<{ referral: Referral | null; referralsMade: ReferralMade[] }>(
        `/api/admin/members/${current._id}/referrer`,
        { method: "PUT", token, body: JSON.stringify({ referrerMemberId }) }
      );
      setReferral(r.referral || null);
      setReferralsMade(r.referralsMade || []);
      setReferrerEditing(false);
      setReferrerQuery("");
    } catch (e) {
      setReferrerError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setReferrerSaving(false);
    }
  }

  async function loadPropaneCompanies() {
    if (!token) return;
    try {
      const { propaneCompanies: rows } = await api<{ propaneCompanies: PropaneCompany[] }>(
        "/api/admin/propane-companies",
        { token }
      );
      setPropaneCompanies(rows);
    } catch {
      // Non-fatal: filter dropdown will just be empty.
    }
  }

  useEffect(() => {
    setFilters(decodeFilters(searchParams.get("filters") || ""));
    setQuickSearch(searchParams.get("q") || "");
  }, [searchParams]);

  function applyFilters(next: MemberFilter[]) {
    setFilters(next);
    setSearchParams((prev) => {
      const np = new URLSearchParams(prev);
      const enc = encodeFilters(next);
      if (enc) np.set("filters", enc);
      else np.delete("filters");
      return np;
    });
  }

  function applyQuickSearch(value: string) {
    setQuickSearch(value);
    setSearchParams((prev) => {
      const np = new URLSearchParams(prev);
      const trimmed = value.trim();
      if (trimmed) np.set("q", trimmed);
      else np.delete("q");
      return np;
    });
  }

  function selectMemberById(id: string) {
    setSearchParams((prev) => {
      const np = new URLSearchParams(prev);
      np.set("member", id);
      return np;
    });
  }

  useEffect(() => {
    void loadOilCompanies();
    void loadPropaneCompanies();
    void loadReferralSources();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) return;
    function onFocus() {
      void loadOilCompanies();
      void loadPropaneCompanies();
      void loadReferralSources();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    void loadMembers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    missingMemberFetchAttempt.current = null;
  }, [memberParam]);

  const filterFields = useMemo(
    () => buildFilterFields(oilCompanies),
    [oilCompanies]
  );

  const filteredMembers = useMemo(() => {
    const q = quickSearch.trim().toLowerCase();
    return members.filter((m) => {
      if (filters.length > 0) {
        const allFiltersMatch = filters.every((f) => {
          const def = filterFields.find((x) => x.key === f.field);
          return evaluateFilter(m as unknown as Record<string, unknown>, f, def);
        });
        if (!allFiltersMatch) return false;
      }
      if (q) {
        // If the entire query is a known state abbreviation or full state name
        // (e.g. "ri", "Rhode Island"), restrict the match to the state field
        // — both the literal stored value and any equivalent synonym (so a
        // member stored as "RI" or "Rhode Island" both match either query).
        const stateMatch = exactStateMatch(q);
        if (stateMatch) {
          const [abbr, full] = stateMatch;
          const wanted = new Set([abbr.toLowerCase(), full.toLowerCase()]);
          const stateLower = String(m.state || "").toLowerCase().trim();
          const synonyms = stateSynonyms(m.state).map((s) => s.toLowerCase());
          if (!wanted.has(stateLower) && !synonyms.some((s) => wanted.has(s))) return false;
        } else {
          const legacyValues =
            m.legacyProfile && typeof m.legacyProfile === "object"
              ? Object.values(m.legacyProfile as Record<string, unknown>)
              : [];
          const noteHistoryTexts = (m.notesHistory || []).map((n) => n.text);
          const lp = (m.legacyProfile || {}) as Record<string, unknown>;
          const fullNameParts = [
            m.firstName,
            lp.midName1,
            m.lastName,
            lp.suffix1,
            lp.firstName2,
            lp.midName2,
            lp.lastName2,
            lp.suffix2,
          ].filter(Boolean).map((x) => String(x).trim()).filter(Boolean);
          const combinedFullName = fullNameParts.join(" ");
          const fullAddress = [m.addressLine1, m.addressLine2, m.city, m.state, m.postalCode]
            .filter(Boolean)
            .map((x) => String(x).trim())
            .filter(Boolean)
            .join(" ");
          const haystack = [
            m.memberNumber,
            m.firstName,
            m.lastName,
            combinedFullName,
            m.email,
            m.phone,
            m.addressLine1,
            m.addressLine2,
            fullAddress,
            m.city,
            m.state,
            ...stateSynonyms(m.state),
            m.postalCode,
            m.notes,
            ...noteHistoryTexts,
            m.oilCompanyId?.name,
            m.status,
            ...legacyValues,
          ]
            .filter(Boolean)
            .map((x) => String(x).toLowerCase());
          if (!haystack.some((field) => field.includes(q))) return false;
        }
      }
      return true;
    });
  }, [members, filters, filterFields, quickSearch]);

  /** Select member from `?member=` or load that record if it is outside the current result set. */
  useEffect(() => {
    if (!token || !memberParam || loading) return;
    const filteredIdx = filteredMembers.findIndex((m) => m._id === memberParam);
    if (filteredIdx >= 0) {
      setIndex(filteredIdx);
      missingMemberFetchAttempt.current = null;
      return;
    }
    if (members.some((m) => m._id === memberParam)) {
      applyFilters([]);
      applyQuickSearch("");
      missingMemberFetchAttempt.current = null;
      return;
    }
    if (missingMemberFetchAttempt.current === memberParam) return;
    missingMemberFetchAttempt.current = memberParam;
    let cancelled = false;
    api<{ member: Member }>(`/api/admin/members/${memberParam}`, { token })
      .then((r) => {
        if (cancelled || !r?.member) return;
        missingMemberFetchAttempt.current = null;
        setMembers((prev) => {
          if (prev.some((m) => m._id === r.member._id)) return prev;
          return [r.member, ...prev];
        });
        setIndex(0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, memberParam, loading, members, filteredMembers]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("workbench.backupHistory");
      const parsed = raw ? (JSON.parse(raw) as BackupHistoryEntry[]) : [];
      setBackupHistory(Array.isArray(parsed) ? parsed : []);
    } catch {
      setBackupHistory([]);
    }
  }, []);

  const current = filteredMembers[index] || null;
  const deliveryRows = useMemo(
    () => parseDeliveryRows((form.legacyProfile || {})["deliveryHistoryRows"]),
    [form.legacyProfile]
  );

  useEffect(() => {
    if (!token || !current) {
      setBilling([]);
      setCommunications([]);
      setReferral(null);
      setEmailMergeData(null);
      formAppliesToMemberIdRef.current = null;
      baselineSerializedRef.current = "";
      return;
    }
    const lp = { ...(current.legacyProfile || {}) } as Record<string, unknown>;
    if (typeof lp.workbenchMemberStatus !== "string" || !lp.workbenchMemberStatus) {
      lp.workbenchMemberStatus = defaultWorkbenchMemberStatus({ ...current, legacyProfile: lp });
    }
    if (typeof lp.phone2 === "string" && lp.phone2) lp.phone2 = formatPhoneValue(lp.phone2);
    if (typeof lp.phone3 === "string" && lp.phone3) lp.phone3 = formatPhoneValue(lp.phone3);
    const nextForm: WorkbenchFormState = {
      firstName: current.firstName || "",
      lastName: current.lastName || "",
      email: current.email || "",
      phone: formatPhoneValue(current.phone || ""),
      addressLine1: current.addressLine1 || "",
      addressLine2: current.addressLine2 || "",
      city: current.city || "",
      state: current.state || "",
      postalCode: current.postalCode || "",
      notes: current.notes || "",
      oilCompanyId: current.oilCompanyId?._id || "",
      legacyProfile: lp,
    };
    formAppliesToMemberIdRef.current = current._id;
    baselineSerializedRef.current = serializeWorkbenchForm(nextForm);
    formRef.current = nextForm;
    setForm(nextForm);
    setSaveTick((t) => t + 1);
    api<{ billing: BillingEvent[]; communications: Comm[]; referral: Referral | null; referralsMade?: ReferralMade[]; merge?: Record<string, unknown> }>(
      `/api/admin/members/${current._id}`,
      { token }
    ).then((r) => {
      setBilling(r.billing || []);
      setCommunications(r.communications || []);
      setReferral(r.referral || null);
      setReferralsMade(r.referralsMade || []);
      setReferrerEditing(false);
      setReferrerQuery("");
      setReferrerError("");
    });
    api<{ merge: Record<string, unknown> }>(`/api/admin/members/${current._id}/email-merge-data`, { token })
      .then((r) => setEmailMergeData(r.merge || null))
      .catch(() => setEmailMergeData(null));
  }, [current?._id, token]);

  const stats = useMemo(() => {
    const active = members.filter((m) => m.status === "active").length;
    const inactive = members.filter((m) => m.status !== "active").length;
    return { active, inactive, total: members.length };
  }, [members]);

  useEffect(() => {
    if (!token) return;
    setMailTemplatesLoading(true);
    api<{ templates: EmailTemplateInfo[] }>("/api/admin/email-templates", { token })
      .then((res) => {
        const byKey = res.templates.reduce(
          (acc, t) => {
            acc[t.key] = t;
            return acc;
          },
          {} as Record<string, EmailTemplateInfo>
        );
        setEmailTemplates(byKey);
        const keys = orderedTemplateKeys(byKey);
        if (keys.length && !byKey[mailTemplateKey]) {
          setMailTemplateKey(keys[0]);
        }
      })
      .catch(() => setEmailTemplates(null))
      .finally(() => setMailTemplatesLoading(false));
  }, [token]);

  useEffect(() => {
    const tpl = emailTemplates?.[mailTemplateKey];
    if (!tpl) return;
    setMailSubject(tpl.subject);
    setMailHtml(tpl.html);
    setMailText(tpl.text);
  }, [mailTemplateKey, emailTemplates]);

  useEffect(() => {
    setMailToEmail(current?.email || "");
  }, [current?.email]);

  useEffect(() => {
    if (!current) {
      setDeliveryHistoryOpen(false);
    }
  }, [current?._id]);

  const worksheetMembers = useMemo(() => {
    const sortCol = WORKSHEET_COLUMNS.find((c) => c.key === worksheetSort.key);
    const out = [...filteredMembers];
    if (sortCol) {
      out.sort((a, b) => {
        const av = sortCol.get(a).toLowerCase();
        const bv = sortCol.get(b).toLowerCase();
        const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
        return worksheetSort.dir === "asc" ? cmp : -cmp;
      });
    }
    return out;
  }, [filteredMembers, worksheetSort]);

  const worksheetPageSize = 50;
  const worksheetTotalPages = Math.max(1, Math.ceil(worksheetMembers.length / worksheetPageSize));
  const worksheetPageRows = useMemo(() => {
    const safePage = Math.min(Math.max(1, worksheetPage), worksheetTotalPages);
    const start = (safePage - 1) * worksheetPageSize;
    return worksheetMembers.slice(start, start + worksheetPageSize);
  }, [worksheetMembers, worksheetPage, worksheetTotalPages]);

  useEffect(() => {
    setWorksheetPage(1);
  }, [filters, quickSearch, worksheetSort]);

  useEffect(() => {
    setIndex(0);
  }, [filters, quickSearch]);

  useEffect(() => {
    if (filteredMembers.length > 0 && index >= filteredMembers.length) {
      setIndex(filteredMembers.length - 1);
    }
  }, [filteredMembers.length, index]);

  useEffect(() => {
    setWorksheetPage((p) => Math.min(p, worksheetTotalPages));
  }, [worksheetTotalPages]);

  function toggleWorksheetSort(key: string) {
    setWorksheetSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function oilCoDisplayCode(oc: OilCompany) {
    const n = oc.name.trim();
    if (n.length <= 5) return n.toUpperCase();
    return n
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 5);
  }

  const recordCount = `${filteredMembers.length ? Math.min(index + 1, filteredMembers.length) : 0}`;

  const selectedOilCompanyRecord = useMemo(
    () => oilCompanies.find((oc) => oc._id === form.oilCompanyId) || null,
    [oilCompanies, form.oilCompanyId]
  );
  const selectedOilCompanyName = selectedOilCompanyRecord?.name || current?.oilCompanyId?.name || "";

  /** Full oil-company catalog for workbench code dropdowns (sorted for scanning). */
  const workbenchOilCompanyRows = useMemo(
    () =>
      [...oilCompanies]
        .map((oc) => ({ oc, code: oilCoCode(oc.notes).trim() }))
        .sort((a, b) => {
          const ak = (a.code || a.oc.name).toLowerCase();
          const bk = (b.code || b.oc.name).toLowerCase();
          const c = ak.localeCompare(bk, undefined, { sensitivity: "base", numeric: true });
          return c !== 0 ? c : a.oc.name.localeCompare(b.oc.name, undefined, { sensitivity: "base" });
        }),
    [oilCompanies]
  );

  /** Prop co dropdown value is oil company id; legacy still stores short code + company name. */
  const propCoSelectCompanyId = useMemo(() => {
    const lp = form.legacyProfile || {};
    const pc = String(lp.propCoCode ?? "").trim();
    const pname = String(lp.propaneCompanyName ?? "").trim().toLowerCase();
    if (!pc && !pname) return "";
    for (const { oc, code } of workbenchOilCompanyRows) {
      if (code && code === pc) return oc._id;
    }
    for (const { oc } of workbenchOilCompanyRows) {
      if (pname && oc.name.trim().toLowerCase() === pname) return oc._id;
    }
    return "";
  }, [form.legacyProfile, workbenchOilCompanyRows]);

  const propCoLegacyUnmatched = useMemo(() => {
    const pc = String(form.legacyProfile?.propCoCode ?? "").trim();
    return Boolean(pc) && !propCoSelectCompanyId;
  }, [form.legacyProfile, propCoSelectCompanyId]);

  const deliveryModalMember = useMemo(
    () => ({
      memberNumber: current?.memberNumber || String(form.legacyProfile.legacyId || ""),
      createdAt: current?.createdAt,
      firstName: form.firstName,
      lastName: form.lastName,
      oilCoCode: oilCoCode(selectedOilCompanyRecord?.notes),
      oilCompanyName: selectedOilCompanyName,
      oilId: String(form.legacyProfile.oilId || ""),
      oilStatus: String(form.legacyProfile.oilWorkbenchStatus || form.legacyProfile.workbenchMemberStatus || "UNKNOWN"),
      propCoCode: String(form.legacyProfile.propCoCode || ""),
      propaneCompanyName: String(form.legacyProfile.propaneCompanyName || ""),
      propaneId: String(form.legacyProfile.propaneId || ""),
      propaneStatus: String(form.legacyProfile.propaneStatus || "UNKNOWN"),
      deliveryHistory: Boolean(form.legacyProfile.deliveryHistory),
      delinquent: Boolean(form.legacyProfile.delinquent),
      notPaidCurrentYr: Boolean(form.legacyProfile.notPaidCurrentYr),
      nrdOil: Boolean(form.legacyProfile.nrdOil),
      nrdProp: Boolean(form.legacyProfile.nrdProp),
    }),
    [current?.memberNumber, current?.createdAt, form, selectedOilCompanyRecord?.notes, selectedOilCompanyName]
  );

  const formIsDirty = useMemo(
    () =>
      Boolean(current) &&
      formAppliesToMemberIdRef.current === current?._id &&
      Boolean(baselineSerializedRef.current) &&
      serializeWorkbenchForm(form) !== baselineSerializedRef.current,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, current?._id, saveTick]
  );

  const downloadText = (filename: string, content: string, mime = "text/plain;charset=utf-8") => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsv = (filename: string, headers: string[], rows: Array<Array<unknown>>) => {
    const body = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    downloadText(filename, body, "text/csv;charset=utf-8");
  };

  const openPrintPreview = (
    title: string,
    body: string,
    triggerPrint = false,
    blackAndWhite = false,
    kind: "email" | "letter" | "document" = "document"
  ) => {
    const w = window.open("", "_blank", "width=960,height=720");
    if (!w) {
      setActionMessage("Popup blocked. Please allow popups for print preview.");
      return;
    }
    const html = previewPopupDocument(title, body, kind, blackAndWhite);
    try {
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch {
      w.location.href = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    }
    if (triggerPrint) {
      w.focus();
      w.print();
    }
  };

  const brandedShell = (title: string, content: string, options?: { brandTitle?: string; brandSubtitle?: string }) => `
    <div style="max-width:900px;margin:0 auto">
      <header style="border-bottom:2px solid #c2410c;padding-bottom:10px;margin-bottom:18px">
        <div style="font-size:22px;font-weight:700;color:#1f2937">${escHtml(options?.brandTitle || "Oil Co-op Administrative Office")}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px">${escHtml(options?.brandSubtitle || "Member Services Workbench")}</div>
      </header>
      <h1 style="margin:0 0 12px;font-size:20px;color:#111827">${escHtml(title)}</h1>
      ${content}
      <footer style="margin-top:22px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:11px;color:#6b7280">
        Generated ${new Date().toLocaleString()}
      </footer>
    </div>
  `;

  const previewLetterHtml = (
    bodyText: string,
    recipient: { firstName?: string; lastName?: string; address?: string; cityStateZip?: string }
  ) =>
    wrapLetterPreview(
      plainTextToEmailMiddle(bodyText),
      letterContextFromMember(recipient)
    );

  const nav = (kind: "first" | "prev" | "next" | "last") => {
    if (!filteredMembers.length) return;
    if (kind === "first") setIndex(0);
    if (kind === "last") setIndex(filteredMembers.length - 1);
    if (kind === "prev") setIndex((i) => Math.max(0, i - 1));
    if (kind === "next") setIndex((i) => Math.min(filteredMembers.length - 1, i + 1));
  };

  const flashSaveToast = useCallback((message: string, ok: boolean) => {
    if (saveToastTimerRef.current) clearTimeout(saveToastTimerRef.current);
    setSaveToast({ message, ok });
    saveToastTimerRef.current = setTimeout(() => {
      setSaveToast(null);
      saveToastTimerRef.current = null;
    }, 3200);
  }, []);

  const persistWorkbench = useCallback(
    async (f: WorkbenchFormState, memberId: string) => {
      if (!token) return false;
      if (saveInFlightRef.current) return false;
      const body = buildWorkbenchPatchBody(f);
      saveInFlightRef.current = true;
      setIsSaving(true);
      try {
        const { member: raw } = await api<{ member: Record<string, unknown> }>(`/api/admin/members/${memberId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(body),
        });
        setMembers((prev) =>
          prev.map((m) => (m._id === memberId ? memberFromApiPatch(m, raw, oilCompanies) : m))
        );
        baselineSerializedRef.current = serializeWorkbenchForm({
          ...f,
          legacyProfile: sortLegacyProfileKeys(body.legacyProfile as Record<string, unknown>),
        });
        setSaveTick((t) => t + 1);
        return true;
      } catch {
        return false;
      } finally {
        saveInFlightRef.current = false;
        setIsSaving(false);
      }
    },
    [token, oilCompanies]
  );

  const saveCurrent = async () => {
    if (!token || !current) return;
    const ok = await persistWorkbench(form, current._id);
    if (ok) flashSaveToast("Saved", true);
    else flashSaveToast("Save failed", false);
  };

  /**
   * Replace the delivery rows in the in-memory form after a CRUD op against
   * /api/admin/deliveries. Re-baseline so the unrelated workbench Save button
   * doesn't think the form is dirty just because rows changed on the server.
   */
  const applyDeliveryRows = useCallback((rows: DeliveryHistoryRow[]) => {
    setForm((prev) => {
      const lp = { ...(prev.legacyProfile || {}) } as Record<string, unknown>;
      lp.deliveryHistoryRows = rows;
      const next = { ...prev, legacyProfile: lp };
      formRef.current = next;
      baselineSerializedRef.current = serializeWorkbenchForm(next);
      return next;
    });
    setSaveTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!token || !current) return;
    if (formAppliesToMemberIdRef.current !== current._id) return;
    if (!baselineSerializedRef.current) return;
    if (serializeWorkbenchForm(formRef.current) === baselineSerializedRef.current) return;
    const memberId = current._id;
    const t = window.setTimeout(() => {
      void (async () => {
        if (formAppliesToMemberIdRef.current !== memberId) return;
        const f = formRef.current;
        if (serializeWorkbenchForm(f) === baselineSerializedRef.current) return;
        if (saveInFlightRef.current) return;
        const ok = await persistWorkbench(f, memberId);
        if (ok) flashSaveToast("Saved", true);
        else flashSaveToast("Save failed", false);
      })();
    }, WORKBENCH_AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [form, current?._id, token, persistWorkbench, flashSaveToast]);

  const setLegacy = (key: string, value: string | boolean) =>
    setForm((f) => {
      const nextLegacy = { ...f.legacyProfile, [key]: value } as Record<string, unknown>;
      if (key === "newMemberDt") {
        nextLegacy.oilStartDate = String(value ?? "");
      }
      return { ...f, legacyProfile: nextLegacy };
    });

  // Toggling Call Back persists immediately rather than waiting for the
  // debounced autosave — otherwise navigating to the Callbacks page or
  // refreshing before the timer fires drops the change.
  const toggleCallBack = (checked: boolean) => {
    const next = {
      ...formRef.current,
      legacyProfile: { ...formRef.current.legacyProfile, callBack: checked },
    };
    setForm(next);
    if (current) {
      void persistWorkbench(next, current._id).then((ok) =>
        flashSaveToast(ok ? "Saved" : "Save failed", ok)
      );
    }
  };

  const legacyValue = (key: string) => String(form.legacyProfile[key] ?? "");

  const legacyBool = (key: string) => Boolean(form.legacyProfile[key]);
  const membershipCheckboxStyle = (checked: boolean) => ({
    appearance: "none" as const,
    WebkitAppearance: "none" as const,
    width: "12px",
    height: "12px",
    margin: 0,
    border: "1px solid #94a3b8",
    borderRadius: "3px",
    background: checked ? "var(--wb-accent)" : "transparent",
    boxShadow: checked ? "inset 0 0 0 2px #ffffff" : "none",
    cursor: "pointer",
  });

  const isSenior = legacyBool("seniorMember");
  const isLifetime = legacyBool("waiveFeeLifetime");
  const isWaived = legacyBool("waiveFeeSenior") || String(legacyValue("registrationPaymentStatus")).toLowerCase() === "waived";
  const isLowVolume = legacyBool("lowVolume");

  const addMember = async (prospect: boolean) => {
    if (!token) return;
    const stamp = Date.now().toString().slice(-5);
    await api("/api/admin/members", {
      method: "POST",
      token,
      body: JSON.stringify({
        firstName: prospect ? "Prospective" : "New",
        lastName: stamp,
        notes: prospect ? "Created from workbench" : "Created from workbench",
        status: "active",
      }),
    });
    await loadMembers();
  };

  const deleteCurrent = async () => {
    if (!token || !current) return;
    if (!confirm(`Delete ${current.firstName} ${current.lastName}?`)) return;
    await api(`/api/admin/members/${current._id}`, { method: "DELETE", token });
    await loadMembers();
  };

  // Oil Company CRUD functions
  const saveOilCompany = async () => {
    if (!token) return;
    if (editingOilCo) {
      await api(`/api/admin/oil-companies/${editingOilCo._id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(oilCoForm),
      });
    } else {
      await api("/api/admin/oil-companies", {
        method: "POST",
        token,
        body: JSON.stringify(oilCoForm),
      });
    }
    await loadOilCompanies();
    setEditingOilCo(null);
    setShowAddOilCo(false);
    setOilCoForm({ name: "", contactEmail: "", contactPhone: "", notes: "" });
  };

  const deleteOilCompany = async (id: string, name: string) => {
    if (!token) return;
    if (!confirm(`Delete oil company "${name}"?`)) return;
    await api(`/api/admin/oil-companies/${id}`, { method: "DELETE", token });
    await loadOilCompanies();
  };

  const startEditOilCo = (oc: OilCompany) => {
    setEditingOilCo(oc);
    setOilCoForm({
      name: oc.name,
      contactEmail: oc.contactEmail || "",
      contactPhone: oc.contactPhone || "",
      notes: oc.notes || "",
    });
    setShowAddOilCo(false);
  };

  const startAddOilCo = () => {
    setEditingOilCo(null);
    setOilCoForm({ name: "", contactEmail: "", contactPhone: "", notes: "" });
    setShowAddOilCo(true);
  };

  const cancelOilCoEdit = () => {
    setEditingOilCo(null);
    setShowAddOilCo(false);
    setOilCoForm({ name: "", contactEmail: "", contactPhone: "", notes: "" });
  };

  // Notes functions
  const addNote = async () => {
    if (!token || !current || !newNote.trim()) return;
    await api(`/api/admin/members/${current._id}/notes`, {
      method: "POST",
      token,
      body: JSON.stringify({ text: newNote.trim() }),
    });
    setNewNote("");
    await loadMembers();
  };

  const saveBackupHistory = (next: BackupHistoryEntry[]) => {
    setBackupHistory(next);
    localStorage.setItem("workbench.backupHistory", JSON.stringify(next));
  };

  const runBackupNow = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      members,
      oilCompanies,
      selectedMember: current,
      selectedMemberBilling: billing,
      selectedMemberCommunications: communications,
    };
    const text = JSON.stringify(payload, null, 2);
    const file = `oilcoop-backup-${fileNameStamp()}.json`;
    downloadText(file, text, "application/json;charset=utf-8");
    const entry: BackupHistoryEntry = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      type: "manual",
      location: file,
      sizeBytes: new Blob([text]).size,
    };
    saveBackupHistory([entry, ...backupHistory].slice(0, 20));
    setLegacy("backupLastAt", new Date().toLocaleString());
    setLegacy("backupPath", file);
    setActionMessage(`Backup created: ${file}`);
  };

  const scheduleBackup = () => {
    const when = legacyValue("backupLastAt") || new Date().toLocaleString();
    const entry: BackupHistoryEntry = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      type: "scheduled",
      location: legacyValue("backupPath") || "scheduled-local-download",
      sizeBytes: 0,
    };
    saveBackupHistory([entry, ...backupHistory].slice(0, 20));
    setActionMessage(`Backup schedule updated (${when}).`);
  };

  const generateMembersCsv = (label: string, rows: Member[]) => {
    downloadCsv(
      `${label.toLowerCase().replace(/\s+/g, "-")}-${fileNameStamp()}.csv`,
      ["Member #", "First Name", "Last Name", "Email", "Phone", "City", "Status", "Workbench Status", "Oil Company"],
      rows.map((m) => [
        m.memberNumber || "",
        m.firstName,
        m.lastName,
        m.email,
        m.phone || "",
        m.city || "",
        m.status,
        defaultWorkbenchMemberStatus(m),
        m.oilCompanyId?.name || "",
      ])
    );
    setActionMessage(`${label} export generated (${rows.length} rows).`);
  };

  const generateWorksheetCsv = (rows: Member[]) => {
    const cols = activeWorksheetColumns.length > 0 ? activeWorksheetColumns : WORKSHEET_COLUMNS;
    downloadCsv(
      `worksheet-${fileNameStamp()}.csv`,
      cols.map((c) => c.label),
      rows.map((m) => cols.map((c) => c.get(m)))
    );
    setActionMessage(`Worksheet export generated (${rows.length} rows, ${cols.length} columns).`);
  };

  const mailingAudience = () => {
    const includeActive = legacyBool("mailIncludeActive");
    const includeProspective = legacyBool("mailIncludeProspective");
    const includeInactive = legacyBool("mailIncludeInactive");
    const noSelections = !includeActive && !includeProspective && !includeInactive;
    return members.filter((m) => {
      const ws = defaultWorkbenchMemberStatus(m);
      if (noSelections) return true;
      if (includeActive && m.status === "active" && ws !== "PROSPECTIVE") return true;
      if (includeProspective && ws === "PROSPECTIVE") return true;
      if (includeInactive && m.status !== "active" && ws !== "PROSPECTIVE") return true;
      return false;
    });
  };

  const memberRecordText = (m: Member) => {
    const lp = (m.legacyProfile || {}) as Record<string, unknown>;
    return [
      `Member Record: ${m.firstName} ${m.lastName}`,
      `Member #: ${m.memberNumber || "—"}`,
      `Email: ${m.email}`,
      `Phone: ${m.phone || "—"}`,
      `Address: ${[m.addressLine1, m.addressLine2, m.city, m.state, m.postalCode].filter(Boolean).join(", ") || "—"}`,
      `Status: ${m.status}`,
      `Workbench Status: ${defaultWorkbenchMemberStatus(m)}`,
      `Oil Company: ${m.oilCompanyId?.name || "—"}`,
      "",
      "Legacy Fields",
      JSON.stringify(lp, null, 2),
      "",
      "Notes",
      m.notes || "—",
      "",
      "Saved Notes History",
      ...((m.notesHistory || []).map((n) => `${new Date(n.createdAt).toLocaleString()} (${n.createdBy}) ${n.text}`) || ["—"]),
    ].join("\n");
  };

  const memberDisplayName = current ? `${current.firstName} ${current.lastName}` : "";
  const primaryAddressLine = [
    current?.addressLine1,
    legacyValue("aptNo1") ? `Apt ${legacyValue("aptNo1")}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  const primaryCityStateZip = [current?.city, current?.state, current?.postalCode]
    .filter(Boolean)
    .join(" ")
    .trim();
  const mailingAddressLine = [
    current?.addressLine2,
    legacyValue("mailApt") ? `Apt ${legacyValue("mailApt")}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  const mailingCityStateZip = [
    legacyValue("mailCity") || current?.city || "",
    legacyValue("mailState") || current?.state || "",
    legacyValue("mailZip") || current?.postalCode || "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  const hasMailingAddress = Boolean(mailingAddressLine || mailingCityStateZip);
  const useMailingAddress = legacyBool("mailAddr") && hasMailingAddress;
  const mailingMergeData = useMemo((): Record<string, unknown> => {
    const oilNotes = parseOilCompanyNotes(selectedOilCompanyRecord?.notes);
    const ccDigits = String(form.legacyProfile.ccNumber ?? "").replace(/\D/g, "");
    const legacyCardLast4 = ccDigits.length >= 4 ? ccDigits.slice(-4) : "";
    return {
      ...(emailMergeData || {}),
      firstName: form.firstName || current?.firstName || emailMergeData?.firstName || "",
      lastName: form.lastName || current?.lastName || emailMergeData?.lastName || "",
      memberName: memberDisplayName || String(emailMergeData?.memberName ?? "Member"),
      memberNumber: current?.memberNumber || emailMergeData?.memberNumber || "—",
      address: (useMailingAddress ? mailingAddressLine : primaryAddressLine) || emailMergeData?.address || "—",
      cityStateZip: (useMailingAddress ? mailingCityStateZip : primaryCityStateZip) || emailMergeData?.cityStateZip || "—",
      email: form.email || current?.email || emailMergeData?.email || "—",
      phone: form.phone || current?.phone || emailMergeData?.phone || "—",
      companyName: selectedOilCompanyName || emailMergeData?.companyName || "Assigned Oil Company",
      companyPhone: selectedOilCompanyRecord?.contactPhone || emailMergeData?.companyPhone || "",
      contactEmail: selectedOilCompanyRecord?.contactEmail || emailMergeData?.contactEmail || "",
      contactName: oilNotes.contactName || emailMergeData?.contactName || "",
      companyAddress: oilNotes.companyAddress || emailMergeData?.companyAddress || "",
      cardLast4: legacyCardLast4 || emailMergeData?.cardLast4 || "",
    };
  }, [
    emailMergeData,
    form,
    current,
    memberDisplayName,
    useMailingAddress,
    mailingAddressLine,
    primaryAddressLine,
    mailingCityStateZip,
    primaryCityStateZip,
    selectedOilCompanyName,
    selectedOilCompanyRecord,
  ]);

  const mergedMailSubject = applyTemplateVariables(mailSubject, mailingMergeData);
  const mergedMailHtml = applyTemplateVariables(mailHtml, mailingMergeData);
  const mergedMailText = applyTemplateVariables(mailText, mailingMergeData);

  const mailingLetterCtx = letterContextFromMember({
    firstName: (form.firstName || current?.firstName) as string | undefined,
    lastName: (form.lastName || current?.lastName) as string | undefined,
    address: mailingMergeData.address as string,
    cityStateZip: mailingMergeData.cityStateZip as string,
  });
  const mailingPreviewHtml = wrapLetterPreview(plainTextToEmailMiddle(mergedMailText), mailingLetterCtx);
  const mailingEmailPreviewHtml = wrapEmailPreview(mergedMailHtml);

  const refundLetterBody = () =>
    `We are issuing a refund in the amount of $${legacyValue("refundAmount") || "0.00"}.\n\nReason:\n${legacyValue("refundReason") || "No reason provided."}`;

  const startDateLetterBody = () =>
    `Welcome to Oil Co-op.\n\nYour membership start date is: ${legacyValue("startLetterStartDate") || "TBD"}.\n\nPlease keep this letter for your records.`;

  const sendMailingEmail = async () => {
    if (!token || !current) return;
    const to = mailToEmail.trim();
    if (!to) {
      setActionMessage("Recipient email is required.");
      return;
    }
    const confirmed = window.confirm(`Send this email to ${to}?`);
    if (!confirmed) {
      setActionMessage("Email send cancelled.");
      return;
    }
    try {
      setMailSending(true);
      await api(`/api/admin/members/${current._id}/send-email`, {
        method: "POST",
        token,
        body: JSON.stringify({
          to,
          subject: mergedMailSubject,
          body: mergedMailText,
          html: mergedMailHtml,
        }),
      });
      setActionMessage(`Email sent to ${to}.`);
      const details = await api<{ billing: BillingEvent[]; communications: Comm[]; referral: Referral | null }>(
        `/api/admin/members/${current._id}`,
        { token }
      );
      setCommunications(details.communications || []);
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Failed to send email.");
    } finally {
      setMailSending(false);
    }
  };

  // Bulk email targets the Find results when one is loaded, otherwise the current filter.
  const bulkRecipients = bulkAudienceIds
    ? members.filter((m) => bulkAudienceIds.includes(m._id))
    : filteredMembers;

  // Map member records to the fields a printed membership invoice needs.
  const toInvoiceMembers = (list: Member[]): InvoiceMember[] =>
    list.map((m) => {
      const lp = (m.legacyProfile || {}) as Record<string, unknown>;
      const name2 = `${String(lp.firstName2 || "").trim()} ${String(lp.lastName2 || "").trim()}`.trim();
      const cityStateZip = [m.city, [m.state, m.postalCode].filter(Boolean).join(" ")]
        .map((s) => String(s || "").trim())
        .filter(Boolean)
        .join(", ");
      const since =
        String(lp.newMemberDt || lp.dateAdd || "").trim() ||
        (m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "");
      return {
        memberNumber: m.memberNumber || String(lp.legacyId || ""),
        name1: `${m.firstName || ""} ${m.lastName || ""}`.trim(),
        name2: name2 || undefined,
        addressLine1: String(m.addressLine1 || "").trim(),
        addressLine2: String(m.addressLine2 || "").trim() || undefined,
        cityStateZip,
        oilCompany: (m.oilCompanyId?.name || String(lp.oilCompanyName || "")).trim(),
        memberSince: since,
      };
    });

  const generateInvoicesFor = (list: Member[], pastDue = false) => {
    const withAddress = list.filter((m) => String(m.addressLine1 || "").trim());
    if (withAddress.length === 0) {
      setActionMessage("No members with a mailing address to invoice.");
      return;
    }
    downloadMembershipInvoicePdf(toInvoiceMembers(withAddress), { pastDue });
    const label = pastDue ? "past-due invoice" : "invoice";
    setActionMessage(
      `Downloaded a PDF with ${withAddress.length} ${label} sheet${withAddress.length === 1 ? "" : "s"} (3 per page). Open it and print at 100% / Actual Size.`
    );
  };

  // Send the same (generic) email to every recipient in the active audience.
  const sendBulkEmail = async () => {
    if (!token) return;
    const recipients = bulkRecipients;
    const withEmail = recipients.filter((m) => String(m.email || "").trim());
    if (recipients.length === 0) {
      setActionMessage("No members in the current filter to email.");
      return;
    }
    if (!mailSubject.trim() || !mailText.trim()) {
      setActionMessage("Add a subject and a message before sending a bulk email.");
      return;
    }
    if (withEmail.length === 0) {
      setActionMessage("None of the filtered members have an email address on file.");
      return;
    }
    const confirmed = window.confirm(
      `Send this email to ${withEmail.length} member${withEmail.length === 1 ? "" : "s"} in the current filter?\n\n` +
        `This is a generic blast — no per-member details are merged. This cannot be undone.`
    );
    if (!confirmed) return;
    try {
      setBulkSending(true);
      const r = await api<{ sent: number; skipped: number; requested: number }>(`/api/admin/members/bulk-email`, {
        method: "POST",
        token,
        body: JSON.stringify({
          memberIds: recipients.map((m) => m._id),
          subject: mailSubject.trim(),
          body: mailText,
          html: mailHtml || undefined,
        }),
      });
      setActionMessage(`Bulk email complete: ${r.sent} sent, ${r.skipped} skipped (no email or opted out).`);
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Bulk send failed.");
    } finally {
      setBulkSending(false);
    }
  };

  const refundLetterHtml = () =>
    previewLetterHtml(refundLetterBody(), {
      firstName: current?.firstName || form.firstName,
      lastName: current?.lastName || form.lastName,
      address: primaryAddressLine,
      cityStateZip: primaryCityStateZip,
    });

  const startDateLetterHtml = () =>
    previewLetterHtml(startDateLetterBody(), {
      firstName: current?.firstName || form.firstName,
      lastName: current?.lastName || form.lastName,
      address: primaryAddressLine,
      cityStateZip: primaryCityStateZip,
    });


  return (
    <div className="admin-workbench">
      <header className="admin-wb-header">
        <div className="admin-wb-header-left">
          <div className="admin-wb-nav">
            <button onClick={() => nav("first")} title="First">|&lt;</button>
            <button onClick={() => nav("prev")} title="Previous">&lt;</button>
            <button onClick={() => nav("next")} title="Next">&gt;</button>
            <button onClick={() => nav("last")} title="Last">&gt;|</button>
          </div>
          <span className="admin-wb-count">
            Record {recordCount} of {filteredMembers.length}
            {filteredMembers.length !== members.length ? ` (${members.length} total)` : ""}
          </span>
        </div>
        <div className="admin-wb-header-right">
          <input
            className="admin-wb-search"
            type="search"
            value={quickSearch}
            onChange={(e) => applyQuickSearch(e.target.value)}
            placeholder="Search records..."
            aria-label="Quick search"
          />
          <MemberFilterWidget
            filters={filters}
            onFiltersChange={applyFilters}
            fields={filterFields}
          />
        </div>
      </header>

      <div className="admin-wb-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`admin-wb-tab${tab === activeTab ? " active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="admin-wb-actions">
        <button className="admin-wb-btn admin-wb-btn-primary" type="button" onClick={() => void addMember(false)}>Add Member</button>
        <button className="admin-wb-btn admin-wb-btn-secondary" type="button" onClick={() => void addMember(true)}>Add Prospect</button>
        <button className="admin-wb-btn admin-wb-btn-danger" type="button" onClick={() => void deleteCurrent()}>Delete</button>
        <button className="admin-wb-btn admin-wb-btn-success" type="button" onClick={() => void saveCurrent()}>Save Changes</button>
      </div>
      {actionMessage && <div className="admin-meta" style={{ padding: "0.35rem 0.9rem" }}>{actionMessage}</div>}
      {saveToast && (
        <div className={`admin-wb-save-toast${saveToast.ok ? " ok" : " err"}`} role="status" aria-live="polite">
          {saveToast.message}
        </div>
      )}

      <div className="admin-wb-body">
        {activeTab === "Data Entry" && current && (
          <div className="admin-wb-grid">
            <div className="admin-wb-col">
            <div className={`admin-wb-panel${collapsedPanels.has("memberIdentity") ? " collapsed" : ""}`}>
              {panelHeader("memberIdentity", "Member Identity")}
              {!collapsedPanels.has("memberIdentity") && (<>
              <div className="admin-status-pill-row" style={{ margin: "0 0 0.5rem" }}>
                {isLifetime && <span className="admin-pill ok">Lifetime Member</span>}
                {isWaived && <span className="admin-pill">Waived</span>}
                {isSenior && <span className="admin-pill">Senior</span>}
                {isLowVolume && <span className="admin-pill">Low Volume</span>}
              </div>
              <div className="admin-form-grid-4">
                <div
                  className="admin-form-span-4"
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "end",
                    gap: "0.4rem 0.7rem",
                  }}
                >
                  <label style={{ flex: "0 0 auto", width: "110px" }}>
                    ID
                    <span className="admin-input admin-input-static" aria-readonly="true">
                      {current.memberNumber || legacyValue("legacyId") || "—"}
                    </span>
                  </label>
                  <label style={{ flex: "0 0 auto", width: "130px" }}>
                    New Member Dt
                    <input className="admin-input" type="date" value={legacyValue("newMemberDt")} onChange={(e) => setLegacy("newMemberDt", e.target.value)} />
                  </label>
                  <label style={{ flex: "0 0 auto", width: "130px" }}>
                    Original Start Date
                    <input className="admin-input" type="date" value={legacyValue("originalStartDate")} onChange={(e) => setLegacy("originalStartDate", e.target.value)} />
                  </label>
                  <div
                    style={{
                      flex: "1 1 auto",
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: "0.3rem 0.75rem",
                      paddingBottom: "0.32rem",
                      minWidth: 0,
                    }}
                  >
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem", fontWeight: 600, whiteSpace: "nowrap" }}>
                      <input type="checkbox" checked={legacyBool("standardMembership")} onChange={(e) => setLegacy("standardMembership", e.target.checked)} style={membershipCheckboxStyle(legacyBool("standardMembership"))} />
                      Standard
                    </label>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem", fontWeight: 600, whiteSpace: "nowrap" }}>
                      <input type="checkbox" checked={legacyBool("seniorMember")} onChange={(e) => setLegacy("seniorMember", e.target.checked)} style={membershipCheckboxStyle(legacyBool("seniorMember"))} />
                      Senior
                    </label>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem", fontWeight: 600, whiteSpace: "nowrap" }}>
                      <input type="checkbox" checked={legacyBool("lowVolume")} onChange={(e) => setLegacy("lowVolume", e.target.checked)} style={membershipCheckboxStyle(legacyBool("lowVolume"))} />
                      Low Volume
                    </label>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem", fontWeight: 600, whiteSpace: "nowrap" }}>
                      <input type="checkbox" checked={legacyBool("waiveFeeLifetime")} onChange={(e) => setLegacy("waiveFeeLifetime", e.target.checked)} style={membershipCheckboxStyle(legacyBool("waiveFeeLifetime"))} />
                      Lifetime
                    </label>
                  </div>
                </div>
                <div
                  className="admin-form-span-4"
                  style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: "0.35rem 0.7rem" }}
                >
                  <label style={{ flex: "0 0 auto", width: "140px" }}>First Name 1<input className="admin-input" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} /></label>
                  <label style={{ flex: "0 0 auto", width: "90px" }}>Mid Name 1<input className="admin-input" value={legacyValue("midName1")} onChange={(e) => setLegacy("midName1", e.target.value)} /></label>
                  <label style={{ flex: "0 0 auto", width: "140px" }}>Last Name 1<input className="admin-input" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} /></label>
                  <label style={{ flex: "0 0 auto", width: "60px" }}>Suffix 1<input className="admin-input" value={legacyValue("suffix1")} onChange={(e) => setLegacy("suffix1", e.target.value)} /></label>
                  <label
                    style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem", fontWeight: 600, paddingBottom: "0.32rem", whiteSpace: "nowrap" }}
                    title="Address letters and emails to both names"
                  >
                    <input type="checkbox" checked={legacyBool("useBothNames")} onChange={(e) => setLegacy("useBothNames", e.target.checked)} style={membershipCheckboxStyle(legacyBool("useBothNames"))} />
                    Use Both Names
                  </label>
                </div>
                <div
                  className="admin-form-span-4"
                  style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: "0.35rem 0.7rem" }}
                >
                  <label style={{ flex: "0 0 auto", width: "140px" }}>First Name 2<input className="admin-input" value={legacyValue("firstName2")} onChange={(e) => setLegacy("firstName2", e.target.value)} /></label>
                  <label style={{ flex: "0 0 auto", width: "90px" }}>Mid Name 2<input className="admin-input" value={legacyValue("midName2")} onChange={(e) => setLegacy("midName2", e.target.value)} /></label>
                  <label style={{ flex: "0 0 auto", width: "140px" }}>Last Name 2<input className="admin-input" value={legacyValue("lastName2")} onChange={(e) => setLegacy("lastName2", e.target.value)} /></label>
                  <label style={{ flex: "0 0 auto", width: "60px" }}>Suffix 2<input className="admin-input" value={legacyValue("suffix2")} onChange={(e) => setLegacy("suffix2", e.target.value)} /></label>
                </div>
                <div
                  className="admin-form-span-4"
                  style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: "0.35rem 0.7rem" }}
                >
                  <label style={{ flex: "0 0 auto", width: "220px", whiteSpace: "nowrap" }}>Address 1<input className="admin-input" value={form.addressLine1} onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))} /></label>
                  <label style={{ flex: "0 0 auto", width: "60px", whiteSpace: "nowrap" }}>Apt<input className="admin-input" value={legacyValue("aptNo1")} onChange={(e) => setLegacy("aptNo1", e.target.value)} /></label>
                  <label style={{ flex: "0 0 auto", width: "140px", whiteSpace: "nowrap" }}>City<input className="admin-input" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} /></label>
                  <label style={{ flex: "0 0 auto", width: "50px", whiteSpace: "nowrap" }}>State<input className="admin-input" maxLength={2} value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase().slice(0, 2) }))} /></label>
                  <label style={{ flex: "0 0 auto", width: "80px", whiteSpace: "nowrap" }}>Zip<input className="admin-input" maxLength={10} value={form.postalCode} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))} /></label>
                </div>
                <div
                  className="admin-form-span-4"
                  style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: "0.35rem 0.7rem" }}
                >
                  <label style={{ flex: "0 0 auto", width: "220px", whiteSpace: "nowrap" }}>Mailing Address<input className="admin-input" value={form.addressLine2} onChange={(e) => setForm((f) => ({ ...f, addressLine2: e.target.value }))} /></label>
                  <label style={{ flex: "0 0 auto", width: "60px", whiteSpace: "nowrap" }}>Apt<input className="admin-input" value={legacyValue("mailApt")} onChange={(e) => setLegacy("mailApt", e.target.value)} /></label>
                  <label style={{ flex: "0 0 auto", width: "140px", whiteSpace: "nowrap" }}>City<input className="admin-input" value={legacyValue("mailCity")} onChange={(e) => setLegacy("mailCity", e.target.value)} /></label>
                  <label style={{ flex: "0 0 auto", width: "50px", whiteSpace: "nowrap" }}>State<input className="admin-input" maxLength={2} value={legacyValue("mailState")} onChange={(e) => setLegacy("mailState", e.target.value.toUpperCase().slice(0, 2))} /></label>
                  <label style={{ flex: "0 0 auto", width: "80px", whiteSpace: "nowrap" }}>Zip<input className="admin-input" maxLength={10} value={legacyValue("mailZip")} onChange={(e) => setLegacy("mailZip", e.target.value)} /></label>
                  <label style={{ flex: "0 0 auto", width: "100px", whiteSpace: "nowrap" }}>
                    Mail Addr
                    <span
                      className="admin-input"
                      style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", minHeight: "24px", padding: "0.08rem 0.25rem", border: "none", background: "transparent", boxShadow: "none" }}
                    >
                      <input
                        type="checkbox"
                        checked={legacyBool("mailAddr")}
                        onChange={(e) => setLegacy("mailAddr", e.target.checked)}
                        style={membershipCheckboxStyle(legacyBool("mailAddr"))}
                      />
                    </span>
                  </label>
                </div>
                <div
                  className="admin-form-span-4"
                  style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: "0.35rem 0.7rem" }}
                >
                  <label style={{ flex: "0 0 auto", width: "150px" }}>
                    Phone 1
                    <input
                      className="admin-input"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      onBlur={(e) => setForm((f) => ({ ...f, phone: formatPhoneValue(e.target.value) }))}
                    />
                  </label>
                  <label style={{ flex: "0 0 auto", width: "90px" }}>
                    Type
                    <select className="admin-input" value={legacyValue("typePhone1") || "HOME"} onChange={(e) => setLegacy("typePhone1", e.target.value)}>
                      {PHONE_TYPE.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ flex: "0 0 auto", width: "60px" }}>
                    Ext
                    <input
                      className="admin-input"
                      inputMode="numeric"
                      maxLength={3}
                      value={legacyValue("p1Ext")}
                      onChange={(e) => setLegacy("p1Ext", e.target.value.replace(/\D/g, "").slice(0, 3))}
                    />
                  </label>
                  <label style={{ flex: "0 0 auto", width: "220px" }}>E Mail<input className="admin-input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></label>
                  <label style={{ flex: "0 0 auto", width: "100px", whiteSpace: "nowrap" }} title="Email opt-out">
                    Opted out
                    <span
                      className="admin-input"
                      style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", minHeight: "24px", padding: "0.08rem 0.25rem", border: "none", background: "transparent", boxShadow: "none" }}
                    >
                      <input
                        type="checkbox"
                        checked={legacyBool("emailOptOut")}
                        onChange={(e) => setLegacy("emailOptOut", e.target.checked)}
                        style={membershipCheckboxStyle(legacyBool("emailOptOut"))}
                      />
                    </span>
                  </label>
                </div>
                <div
                  className="admin-form-span-4"
                  style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: "0.35rem 0.7rem" }}
                >
                  <label style={{ flex: "0 0 auto", width: "150px" }}>
                    Phone 2
                    <input
                      className="admin-input"
                      value={legacyValue("phone2")}
                      onChange={(e) => setLegacy("phone2", e.target.value)}
                      onBlur={(e) => setLegacy("phone2", formatPhoneValue(e.target.value))}
                    />
                  </label>
                  <label style={{ flex: "0 0 auto", width: "90px" }}>
                    Type
                    <select className="admin-input" value={legacyValue("typePhone2") || "HOME"} onChange={(e) => setLegacy("typePhone2", e.target.value)}>
                      {PHONE_TYPE.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ flex: "0 0 auto", width: "60px" }}>
                    Ext
                    <input
                      className="admin-input"
                      inputMode="numeric"
                      maxLength={3}
                      value={legacyValue("p2Ext")}
                      onChange={(e) => setLegacy("p2Ext", e.target.value.replace(/\D/g, "").slice(0, 3))}
                    />
                  </label>
                  <label style={{ flex: "0 0 auto", width: "220px" }}>E Mail 2<input className="admin-input" value={legacyValue("email2")} onChange={(e) => setLegacy("email2", e.target.value)} /></label>
                </div>
                <div
                  className="admin-form-span-4"
                  style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: "0.35rem 0.7rem" }}
                >
                  <label style={{ flex: "0 0 auto", width: "150px" }}>
                    Phone 3
                    <input
                      className="admin-input"
                      value={legacyValue("phone3")}
                      onChange={(e) => setLegacy("phone3", e.target.value)}
                      onBlur={(e) => setLegacy("phone3", formatPhoneValue(e.target.value))}
                    />
                  </label>
                  <label style={{ flex: "0 0 auto", width: "90px" }}>
                    Type
                    <select className="admin-input" value={legacyValue("typePhone3") || "HOME"} onChange={(e) => setLegacy("typePhone3", e.target.value)}>
                      {PHONE_TYPE.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ flex: "0 0 auto", width: "60px" }}>
                    Ext
                    <input
                      className="admin-input"
                      inputMode="numeric"
                      maxLength={3}
                      value={legacyValue("p3Ext")}
                      onChange={(e) => setLegacy("p3Ext", e.target.value.replace(/\D/g, "").slice(0, 3))}
                    />
                  </label>
                </div>
                <div
                  className="admin-form-span-4"
                  style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem 0.7rem" }}
                >
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem", fontWeight: 600, whiteSpace: "nowrap" }}>
                    <input type="checkbox" checked={legacyBool("callBack")} onChange={(e) => toggleCallBack(e.target.checked)} />
                    Call Back
                  </label>
                  <input
                    className="admin-input"
                    type="date"
                    value={legacyValue("callBackDate")}
                    onChange={(e) => setLegacy("callBackDate", e.target.value)}
                    style={{ width: "140px" }}
                  />
                  <input
                    className="admin-input"
                    type="text"
                    placeholder="Call back notes"
                    value={legacyValue("callBackNotes")}
                    onChange={(e) => setLegacy("callBackNotes", e.target.value)}
                    style={{ flex: "1 1 180px", minWidth: "180px" }}
                  />
                </div>
                <label className="admin-form-span-4 admin-note-field">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                    <span>Internal Notes</span>
                    <span style={{ fontSize: "0.65rem", color: "var(--wb-muted)" }}>
                      {(current?.notesHistory || []).length} saved note(s)
                    </span>
                  </div>
                  <div className="admin-notes-history" style={{ maxHeight: "150px", overflowY: "auto", border: "1px solid var(--wb-border)", borderRadius: "var(--wb-radius-sm)", padding: "0.5rem", marginBottom: "0.5rem", background: "var(--wb-surface)" }}>
                    {(current?.notesHistory || []).length === 0 ? (
                      <p style={{ color: "var(--wb-muted)", fontSize: "0.75rem", margin: 0 }}>No notes yet</p>
                    ) : (
                      [...(current?.notesHistory || [])].reverse().map((note, i) => (
                        <div key={note._id || i} style={{ paddingBottom: "0.5rem", borderBottom: i < (current?.notesHistory || []).length - 1 ? "1px solid var(--wb-border)" : "none", marginBottom: "0.5rem" }}>
                          <div style={{ fontSize: "0.65rem", color: "var(--wb-muted)", marginBottom: "0.15rem" }}>
                            {new Date(note.createdAt).toLocaleDateString()} {new Date(note.createdAt).toLocaleTimeString()} — {note.createdBy}
                          </div>
                          <div style={{ fontSize: "0.8rem", whiteSpace: "pre-wrap" }}>{note.text}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <textarea
                      className="admin-input admin-note-input"
                      style={{ flex: 1 }}
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a new note..."
                      rows={2}
                    />
                    <button
                      type="button"
                      className="admin-wb-btn admin-wb-btn-primary"
                      style={{ alignSelf: "flex-end" }}
                      onClick={addNote}
                      disabled={!newNote.trim()}
                    >
                      Add Note
                    </button>
                  </div>
                </label>
                <div
                  className="admin-form-span-4"
                  style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: "0.35rem 0.7rem" }}>
                    <label style={{ flex: "0 0 auto", width: "180px" }}>Employer<input className="admin-input" value={legacyValue("employer")} onChange={(e) => setLegacy("employer", e.target.value)} /></label>
                    <label style={{ flex: "0 0 auto", width: "160px" }}>Company<input className="admin-input" value={legacyValue("company")} onChange={(e) => setLegacy("company", e.target.value)} /></label>
                    <label style={{ flex: "0 0 auto", width: "120px" }}>
                      The Next Step?
                      <select className="admin-input" value={legacyValue("nextStep")} onChange={(e) => setLegacy("nextStep", e.target.value)}>
                        <option value=""></option>
                        <option value="YES">YES</option>
                        <option value="NO">NO</option>
                      </select>
                    </label>
                    <label style={{ flex: "0 0 auto", width: "120px" }}>
                      How Joined
                      <select className="admin-input" value={legacyValue("howJoined") || "WEB"} onChange={(e) => setLegacy("howJoined", e.target.value)}>
                        {HOW_JOINED.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label style={{ flex: "0 0 auto", width: "120px" }}>
                      Referral
                      {referralCustomOpen ? (
                        <div style={{ display: "flex", gap: "0.25rem" }}>
                          <input
                            className="admin-input"
                            autoFocus
                            placeholder="New source"
                            value={referralCustom}
                            onChange={(e) => setReferralCustom(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const saved = await addReferralSource(referralCustom);
                                if (saved) setLegacy("referralSource", saved);
                                setReferralCustom("");
                                setReferralCustomOpen(false);
                              } else if (e.key === "Escape") {
                                setReferralCustom("");
                                setReferralCustomOpen(false);
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="admin-btn admin-btn-ghost"
                            onClick={async () => {
                              const saved = await addReferralSource(referralCustom);
                              if (saved) setLegacy("referralSource", saved);
                              setReferralCustom("");
                              setReferralCustomOpen(false);
                            }}
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <select
                          className="admin-input"
                          value={legacyValue("referralSource") || "OTHER"}
                          onChange={(e) => {
                            if (e.target.value === "__CUSTOM__") {
                              setReferralCustom("");
                              setReferralCustomOpen(true);
                              return;
                            }
                            setLegacy("referralSource", e.target.value);
                          }}
                        >
                          {Array.from(
                            new Set([...referralSources, legacyValue("referralSource")].filter(Boolean) as string[])
                          ).map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                          <option value="__CUSTOM__">+ Add custom…</option>
                        </select>
                      )}
                    </label>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: "0.35rem 0.7rem", justifyContent: "flex-start", width: "100%" }}>
                    <label style={{ flex: "0 0 auto", width: "130px" }}>Referred By ID<input className="admin-input" value={legacyValue("referredById")} onChange={(e) => setLegacy("referredById", e.target.value)} /></label>
                    <label style={{ flex: "0 0 auto", width: "140px" }}>Date Referred<input className="admin-input" type="date" value={legacyValue("dateReferred")} onChange={(e) => setLegacy("dateReferred", e.target.value)} /></label>
                  </div>
                </div>
              </div>
              </>)}
            </div>

            </div> {/* end left col */}
            <div className="admin-wb-col">
            <div className={`admin-wb-panel${collapsedPanels.has("oilStatus") ? " collapsed" : ""}`}>
              {panelHeader("oilStatus", "Oil Company Status")}
              {!collapsedPanels.has("oilStatus") && (<>
              <div className="admin-wb-status-row">
                {WB_OIL_STATUS.map((s) => (
                  <label key={s} className={`on-${s === "ACTIVE" ? "active" : s === "INACTIVE" ? "inactive" : s === "PROSPECTIVE" ? "prospect" : s === "NO OIL" ? "noOil" : "unknown"}`}>
                    <input
                      type="radio"
                      name="wb-oil-status"
                      checked={(legacyValue("oilWorkbenchStatus") || "ACTIVE") === s}
                      onChange={() => setLegacy("oilWorkbenchStatus", s)}
                    />
                    {s}
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: "0.35rem 0.7rem" }}>
                <label style={{ flex: "0 0 auto", width: "200px" }}>
                  Oil Co Code
                  <select
                    className="admin-input"
                    value={form.oilCompanyId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setForm((f) => {
                        const oc = oilCompanies.find((o) => o._id === id);
                        const lp = { ...f.legacyProfile } as Record<string, unknown>;
                        if (!id || !oc) {
                          lp.oilCoCode = "";
                          return { ...f, oilCompanyId: id, legacyProfile: lp };
                        }
                        lp.oilCoCode = oilCoCode(oc.notes).trim();
                        return { ...f, oilCompanyId: id, legacyProfile: lp };
                      });
                    }}
                  >
                    <option value="">—</option>
                    {workbenchOilCompanyRows.map(({ oc, code }) => (
                      <option key={oc._id} value={oc._id}>
                        {code ? `${code} — ${oc.name}` : oc.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ flex: "0 0 auto", width: "100px" }}>Oil ID<input className="admin-input" value={legacyValue("oilId")} onChange={(e) => setLegacy("oilId", e.target.value)} /></label>
                <label style={{ flex: "0 0 auto", width: "140px" }}>Oil Start Date<input className="admin-input" type="date" value={legacyValue("oilStartDate")} onChange={(e) => setLegacy("oilStartDate", e.target.value)} /></label>
              </div>
              </>)}
            </div>

            <div className={`admin-wb-panel${collapsedPanels.has("propaneInfo") ? " collapsed" : ""}`}>
              {panelHeader("propaneInfo", "Propane Company Status")}
              {!collapsedPanels.has("propaneInfo") && (<>
              <div className="admin-wb-status-row">
                {WB_PROPANE_STATUS.map((s) => (
                  <label key={s} className={`on-${s === "ACTIVE" ? "active" : s === "INACTIVE" ? "inactive" : s === "PROSPECTIVE" ? "prospect" : s === "NO PROPANE" ? "noOil" : "unknown"}`}>
                    <input
                      type="radio"
                      name="wb-propane-status"
                      checked={(legacyValue("propaneStatus") || "UNKNOWN") === s}
                      onChange={() => setLegacy("propaneStatus", s)}
                    />
                    {s}
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: "0.35rem 0.7rem" }}>
                <label style={{ flex: "0 0 auto", width: "200px" }}>
                  Prop Co Code
                  <select
                    className="admin-input"
                    value={propCoSelectCompanyId}
                    title={
                      propCoLegacyUnmatched
                        ? `Legacy prop code not in Oil Companies list: ${String(form.legacyProfile?.propCoCode ?? "").trim()}`
                        : "Same company list as Oil Co Code; sets propane company name and short code"
                    }
                    onChange={(e) => {
                      const id = e.target.value;
                      setForm((f) => {
                        const lp = { ...f.legacyProfile } as Record<string, unknown>;
                        if (!id) {
                          lp.propCoCode = "";
                          lp.propaneCompanyName = "";
                          return { ...f, legacyProfile: lp };
                        }
                        const oc = oilCompanies.find((o) => o._id === id);
                        if (!oc) return f;
                        lp.propCoCode = oilCoCode(oc.notes).trim();
                        lp.propaneCompanyName = oc.name;
                        return { ...f, legacyProfile: lp };
                      });
                    }}
                  >
                    <option value="">—</option>
                    {workbenchOilCompanyRows.map(({ oc, code }) => (
                      <option key={oc._id} value={oc._id}>
                        {code ? `${code} — ${oc.name}` : oc.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ flex: "0 0 auto", width: "100px" }}>Propane ID<input className="admin-input" value={legacyValue("propaneId")} onChange={(e) => setLegacy("propaneId", e.target.value)} /></label>
                <label style={{ flex: "0 0 auto", width: "150px" }}>Propane Start Date<input className="admin-input" type="date" value={legacyValue("propaneStartDate")} onChange={(e) => setLegacy("propaneStartDate", e.target.value)} /></label>
              </div>
              </>)}
            </div>

            <div className={`admin-wb-panel${collapsedPanels.has("deliveryStatus") ? " collapsed" : ""}`}>
              {panelHeader("deliveryStatus", "Delivery Status")}
              {!collapsedPanels.has("deliveryStatus") && (<>
              <div className="admin-checkbox-grid" style={{marginBottom: "0.4rem"}}>
                <label>
                  <input type="checkbox" checked={legacyBool("deliveryHistory")} onChange={(e) => setLegacy("deliveryHistory", e.target.checked)} />
                  Delivery History
                </label>
                <label>
                  <input type="checkbox" checked={legacyBool("nrdOil")} onChange={(e) => setLegacy("nrdOil", e.target.checked)} />
                  NRD-Oil
                </label>
                <label>
                  <input type="checkbox" checked={legacyBool("nrdProp")} onChange={(e) => setLegacy("nrdProp", e.target.checked)} />
                  NRD-Prop
                </label>
              </div>
              <button
                type="button"
                className="admin-btn"
                style={{fontSize: "0.6rem", padding: "0.2rem 0.5rem", background: "#dc2626", color: "#fff", borderColor: "#b91c1c"}}
                onClick={() => setDeliveryHistoryOpen(true)}
              >
                DELIVERY HISTORY
              </button>
              </>)}
            </div>

            <div className={`admin-wb-panel${collapsedPanels.has("solarAudits") ? " collapsed" : ""}`}>
              {panelHeader("solarAudits", "Solar, Insurance & Energy Audits")}
              {!collapsedPanels.has("solarAudits") && (<>
              <div className="admin-wb-audit-section">
                <div className="admin-wb-audit-tag">Solar</div>
                <div className="admin-wb-audit-grid">
                  <label>Referral Sent<input className="admin-input" type="date" value={legacyValue("solorReferralSentDate")} onChange={(e) => setLegacy("solorReferralSentDate", e.target.value)} /></label>
                  <label>Date Paid<input className="admin-input" type="date" value={legacyValue("solorDatePaid")} onChange={(e) => setLegacy("solorDatePaid", e.target.value)} /></label>
                  <label>Paid
                    <select className="admin-input" value={legacyValue("solorPaid") || ""} onChange={(e) => setLegacy("solorPaid", e.target.value)}>
                      <option value=""></option>
                      <option value="YES">YES</option>
                      <option value="NO">NO</option>
                    </select>
                  </label>
                  <label>Panels<input className="admin-input" value={legacyValue("solorPanels")} onChange={(e) => setLegacy("solorPanels", e.target.value)} /></label>
                  <label style={{ gridColumn: "span 2" }}>Notes<input className="admin-input" value={legacyValue("solorNotes")} onChange={(e) => setLegacy("solorNotes", e.target.value)} /></label>
                </div>
              </div>
              <div className="admin-wb-audit-section">
                <div className="admin-wb-audit-tag">Energy</div>
                <div className="admin-wb-audit-grid">
                  <label>Referral<input className="admin-input" type="date" value={legacyValue("energyAuditReferralDate")} onChange={(e) => setLegacy("energyAuditReferralDate", e.target.value)} /></label>
                  <label>Date Paid<input className="admin-input" type="date" value={legacyValue("energyAuditDatePaid")} onChange={(e) => setLegacy("energyAuditDatePaid", e.target.value)} /></label>
                  <label>Notes<input className="admin-input" value={legacyValue("energyAuditNotes")} onChange={(e) => setLegacy("energyAuditNotes", e.target.value)} /></label>
                </div>
              </div>
              <div className="admin-wb-audit-section admin-wb-audit-section-last">
                <div className="admin-wb-audit-tag">Insurance</div>
                <div className="admin-wb-audit-grid">
                  <label>Referral<input className="admin-input" type="date" value={legacyValue("insuranceAuditReferralDate")} onChange={(e) => setLegacy("insuranceAuditReferralDate", e.target.value)} /></label>
                  <label>Date Paid<input className="admin-input" type="date" value={legacyValue("insuranceDatePaid")} onChange={(e) => setLegacy("insuranceDatePaid", e.target.value)} /></label>
                  <label>Notes<input className="admin-input" value={legacyValue("insuranceAuditNotes")} onChange={(e) => setLegacy("insuranceAuditNotes", e.target.value)} /></label>
                </div>
              </div>
              </>)}
            </div>

            <div className={`admin-wb-panel electric${collapsedPanels.has("electricStatus") ? " collapsed" : ""}`}>
              {panelHeader("electricStatus", "Electric Status")}
              {!collapsedPanels.has("electricStatus") && (<>
              <div className="admin-wb-status-row">
                {ELECTRIC_STATUS.map((s) => (
                  <label key={s} className={`on-${s === "ELECTRIC" ? "active" : s === "PENDING" ? "prospect" : s === "INTERESTED" ? "prospect" : s === "DROPPED" ? "inactive" : "unknown"}`}>
                    <input
                      type="radio"
                      name="wb-electric-status"
                      checked={(legacyValue("electricStatus") || "UNKNOWN") === s}
                      onChange={() => setLegacy("electricStatus", s)}
                    />
                    {s}
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: "0.35rem 0.7rem" }}>
                <label style={{ flex: "0 0 auto", width: "140px" }}>Elec Sign Up Date<input className="admin-input" type="date" value={legacyValue("elecSignUpDate")} onChange={(e) => setLegacy("elecSignUpDate", e.target.value)} /></label>
                <label style={{ flex: "0 0 auto", width: "140px" }}>Elec Start Date<input className="admin-input" type="date" value={legacyValue("elecStartDate")} onChange={(e) => setLegacy("elecStartDate", e.target.value)} /></label>
                <label style={{ flex: "0 0 auto", width: "120px" }}>Name Key<input className="admin-input" value={legacyValue("nameKey")} onChange={(e) => setLegacy("nameKey", e.target.value)} /></label>
                <label style={{ flex: "0 0 auto", width: "140px" }}>Dropped Date<input className="admin-input" type="date" value={legacyValue("droppedDate")} onChange={(e) => setLegacy("droppedDate", e.target.value)} /></label>
                <label style={{ flex: "0 0 auto", width: "170px" }}>
                  Electricity Account #
                  <input
                    className="admin-input"
                    inputMode="numeric"
                    maxLength={13}
                    value={legacyValue("electricAccountNumber")}
                    onChange={(e) => setLegacy("electricAccountNumber", e.target.value.replace(/\D/g, "").slice(0, 13))}
                  />
                </label>
              </div>
              </>)}
            </div>

            </div> {/* end right col */}
          </div>
        )}

        {activeTab === "PAYMENT HISTORY" && (
          <>
            <div className="admin-actions-row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.6rem" }}>
              <button type="button" className="admin-btn admin-btn-primary" onClick={() => setPaymentFindOpen(true)}>
                Find members…
              </button>
              <button
                type="button"
                className="admin-btn"
                disabled={!current}
                onClick={() => current && generateInvoicesFor([current])}
              >
                Download invoice PDF (this member)
              </button>
              <button
                type="button"
                className="admin-btn"
                disabled={!current}
                onClick={() => current && generateInvoicesFor([current], true)}
              >
                Download PAST DUE PDF (this member)
              </button>
              <span className="admin-meta">
                Find a group to email or print invoices, or generate one invoice for the open member.
              </span>
            </div>
            {current ? (
              <PaymentHistoryView
                form={form}
                setForm={setForm}
                billing={billing}
                member={current}
                oilCompanyName={selectedOilCompanyName}
                onAddPayment={
                  token
                    ? async (line) => {
                        const r = await api<{ billing: BillingEvent[] }>(
                          `/api/admin/members/${current._id}/billing`,
                          { method: "POST", token, body: JSON.stringify(line) }
                        );
                        setBilling(r.billing || []);
                      }
                    : undefined
                }
                onDeletePayment={
                  token
                    ? async (billingId) => {
                        const r = await api<{ billing: BillingEvent[] }>(
                          `/api/admin/members/${current._id}/billing/${billingId}`,
                          { method: "DELETE", token }
                        );
                        setBilling(r.billing || []);
                      }
                    : undefined
                }
              />
            ) : (
              <p className="admin-meta">Select a member with Search, or use Find members to search the whole list.</p>
            )}
          </>
        )}

        {activeTab === "MAILINGS" && (
          <div className="admin-workbench-data-entry">
            <div className="admin-card admin-workbench-section">
              <h2>Mail Manager</h2>
              <h3>Start from a template</h3>
              <p className="admin-readonly-hint" style={{ margin: "0 0 0.5rem" }}>
                Pick a starting point, then edit the message below. Your changes go out to
                this recipient only — the saved template in Email Templates is not changed.
              </p>
              {mailTemplatesLoading ? (
                <p className="admin-meta">Loading templates…</p>
              ) : enabledMailTemplateKeys.length === 0 ? (
                <p className="admin-meta">No email templates available.</p>
              ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: "0.35rem",
                  marginBottom: "0.55rem",
                }}
              >
                {enabledMailTemplateKeys.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`admin-wb-btn ${mailTemplateKey === key ? "admin-wb-btn-primary" : "admin-wb-btn-secondary"}`}
                    style={{ width: "100%", justifyContent: "center", minHeight: "1.85rem", fontSize: "0.68rem", padding: "0.22rem 0.38rem" }}
                    onClick={() => setMailTemplateKey(key)}
                  >
                    {emailTemplates?.[key]?.name || key}
                  </button>
                ))}
              </div>
              )}
              <div className="admin-form-grid">
                <label>
                  Recipient (selected member)
                  <input className="admin-input" readOnly value={String(mailingMergeData.memberName ?? "")} />
                </label>
                <label className="admin-form-span-2">
                  Recipient Address
                  <input className="admin-input" readOnly value={`${mailingMergeData.address} ${mailingMergeData.cityStateZip}`.trim()} />
                </label>
                <label className="admin-form-span-2">
                  Subject
                  <input className="admin-input" value={mailSubject} onChange={(e) => setMailSubject(e.target.value)} />
                </label>
                <label className="admin-form-span-2">
                  Send To Email
                  <input
                    className="admin-input"
                    value={mailToEmail}
                    onChange={(e) => setMailToEmail(e.target.value)}
                    placeholder="member@example.com"
                  />
                </label>
                <label className="admin-form-span-2 admin-note-field">
                  Message
                  <RichEmailEditor
                    value={mailHtml}
                    onChange={(v) => {
                      setMailHtml(v);
                      setMailText(htmlToPlainText(v));
                    }}
                    tokens={emailTemplates?.[mailTemplateKey]?.variables || []}
                    placeholder="Write your message here…"
                  />
                </label>
                <p className="admin-readonly-hint admin-form-span-2" style={{ margin: "0.15rem 0" }}>
                  Use <strong>+ Personalize</strong> for details like the member's first name.
                  Printed letters use the official letterhead and "Sincerely, {LETTER_ORG.signerName}, {LETTER_ORG.signerTitle}" signature.
                </p>
              </div>
              <div className="admin-actions-row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  style={{ minWidth: "150px" }}
                  disabled={!current || mailSending || !mailToEmail.trim()}
                  onClick={() => void sendMailingEmail()}
                >
                  {mailSending ? "Sending..." : "Email to Recipient"}
                </button>
                <button
                  type="button"
                  className="admin-btn"
                  style={{ minWidth: "130px" }}
                  disabled={!current}
                  onClick={() => openPrintPreview("Mailing Email Preview", mailingEmailPreviewHtml, false, false, "email")}
                >
                  Preview Email
                </button>
                <button
                  type="button"
                  className="admin-btn"
                  style={{ minWidth: "130px" }}
                  onClick={() => openPrintPreview("Mailing Letter Preview", mailingPreviewHtml, false, false, "letter")}
                >
                  Preview Letter
                </button>
                <button
                  type="button"
                  className="admin-btn"
                  style={{ minWidth: "130px" }}
                  onClick={() => openPrintPreview("Mailing Letter", mailingPreviewHtml, true, true, "letter")}
                >
                  Print Letter
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-ghost"
                  style={{ minWidth: "160px" }}
                  onClick={() => generateMembersCsv("Mailing Audience", mailingAudience())}
                >
                  Export Audience CSV
                </button>
              </div>

              {/* Bulk send — same generic email to every filtered member */}
              <div
                className="admin-card admin-workbench-section"
                style={{ marginTop: "0.75rem", background: "#fffbeb", borderColor: "#fcd34d" }}
              >
                <h3 style={{ margin: "0 0 0.35rem" }}>Send to a whole list</h3>
                <p className="admin-readonly-hint" style={{ margin: "0 0 0.6rem" }}>
                  Sends the <strong>subject and message above</strong> to{" "}
                  {bulkAudienceIds ? (
                    <strong>the {bulkRecipients.length} members from your Payment Find</strong>
                  ) : (
                    <strong>every member currently in your filter/search</strong>
                  )}{" "}
                  — use this for a renewal blast to everyone who hasn't paid. Write it generically (e.g. start with
                  &quot;Dear Member&quot;); no per-member details are merged. Members with no email or who opted out are
                  skipped automatically.
                </p>
                {bulkAudienceIds && (
                  <p className="admin-meta" style={{ margin: "0 0 0.5rem" }}>
                    Audience: <strong>Payment Find results</strong> ·{" "}
                    <button type="button" className="admin-link-btn" onClick={() => setBulkAudienceIds(null)}>
                      use current filter instead
                    </button>
                  </p>
                )}
                <div className="admin-actions-row" style={{ gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="admin-btn admin-btn-primary"
                    style={{ minWidth: "220px" }}
                    disabled={bulkSending || bulkRecipients.length === 0 || !mailSubject.trim() || !mailText.trim()}
                    onClick={() => void sendBulkEmail()}
                  >
                    {bulkSending
                      ? "Sending…"
                      : `Email all ${bulkRecipients.filter((m) => String(m.email || "").trim()).length} members`}
                  </button>
                  <span className="admin-meta">
                    {bulkRecipients.length} in {bulkAudienceIds ? "find results" : "filter"} ·{" "}
                    {bulkRecipients.filter((m) => String(m.email || "").trim()).length} with email
                  </span>
                </div>
              </div>
              <div className="admin-card admin-workbench-section" style={{ padding: 0, overflow: "hidden", marginTop: "0.75rem" }}>
                <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #e7e5e4", background: "#fafaf9", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                  <strong>Email preview</strong>
                  <span className="admin-meta" style={{ margin: 0 }}>Same layout as Admin → Email Templates</span>
                </div>
                <div
                  style={{ maxHeight: "520px", overflow: "auto" }}
                  dangerouslySetInnerHTML={{ __html: mailingEmailPreviewHtml }}
                />
              </div>
            </div>
            <div className="admin-card admin-workbench-section">
              <h3>Recent Mailings</h3>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Date</th><th>Type</th><th>Subject</th><th>Status</th></tr></thead>
                  <tbody>
                    {communications.length === 0 ? (
                      <tr><td colSpan={4}>No mailings logged for this member.</td></tr>
                    ) : (
                      communications.map((c) => (
                        <tr key={c._id}>
                          <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                          <td>{c.channel}</td>
                          <td>{c.subject || "—"}</td>
                          <td><span className={`admin-pill${c.status === "sent" ? " ok" : ""}`}>{c.status}</span></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "REFERRALS BY MEMBER" && (
          <div className="admin-workbench-data-entry">
            <div className="admin-card admin-workbench-section">
              <div className="admin-toolbar" style={{ justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <h2 style={{ margin: 0 }}>Referred by</h2>
                {!referrerEditing && (
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button type="button" className="admin-btn" onClick={() => { setReferrerEditing(true); setReferrerError(""); }}>
                      {referral?.referrerMemberId ? "Change" : "Set referrer"}
                    </button>
                    {referral?.referrerMemberId && (
                      <button type="button" className="admin-btn" disabled={referrerSaving} onClick={() => void saveReferrer(null)}>
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Referrer</th><th>Member #</th><th>Email</th></tr></thead>
                  <tbody>
                    <tr>
                      <td>{referral?.referrerMemberId ? `${referral.referrerMemberId.firstName || ""} ${referral.referrerMemberId.lastName || ""}`.trim() || "None" : "None"}</td>
                      <td>{referral?.referrerMemberId?.memberNumber || "—"}</td>
                      <td>{referral?.referrerMemberId?.email || "—"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {referrerError && <p className="admin-error" style={{ marginTop: "0.5rem" }}>{referrerError}</p>}
              {referrerEditing && (
                <div style={{ marginTop: "0.75rem" }}>
                  <div className="admin-toolbar" style={{ marginBottom: "0.5rem" }}>
                    <input
                      className="admin-input"
                      autoFocus
                      placeholder="Search members by name, member #, or email…"
                      value={referrerQuery}
                      onChange={(e) => setReferrerQuery(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button type="button" className="admin-btn" onClick={() => { setReferrerEditing(false); setReferrerQuery(""); }}>
                      Cancel
                    </button>
                  </div>
                  {referrerQuery.trim().length >= 2 && (
                    <div className="admin-table-wrap" style={{ maxHeight: "260px", overflowY: "auto" }}>
                      <table className="admin-table">
                        <tbody>
                          {(() => {
                            const needle = referrerQuery.trim().toLowerCase();
                            const matches = members
                              .filter((m) => m._id !== current?._id)
                              .filter((m) => {
                                const hay = `${m.firstName} ${m.lastName} ${m.memberNumber || ""} ${m.email}`.toLowerCase();
                                return hay.includes(needle);
                              })
                              .slice(0, 25);
                            if (matches.length === 0) {
                              return <tr><td className="admin-meta">No matches</td></tr>;
                            }
                            return matches.map((m) => (
                              <tr key={m._id} style={{ cursor: "pointer" }} onClick={() => { if (!referrerSaving) void saveReferrer(m._id); }}>
                                <td>{`${m.firstName || ""} ${m.lastName || ""}`.trim() || "—"}</td>
                                <td>{m.memberNumber || "—"}</td>
                                <td>{m.email}</td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="admin-card admin-workbench-section">
              <h2>Members they referred ({referralsMade.length})</h2>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Member</th><th>Member #</th><th>Email</th><th>Joined</th></tr></thead>
                  <tbody>
                    {referralsMade.length === 0 ? (
                      <tr><td colSpan={4} className="admin-meta">No referrals yet</td></tr>
                    ) : (
                      referralsMade.map((r) => (
                        <tr key={r._id}>
                          <td>{r.newMemberId ? `${r.newMemberId.firstName || ""} ${r.newMemberId.lastName || ""}`.trim() || "—" : "—"}</td>
                          <td>{r.newMemberId?.memberNumber || "—"}</td>
                          <td>{r.newMemberId?.email || "—"}</td>
                          <td>{r.creditedAt ? new Date(r.creditedAt).toLocaleDateString() : "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "MEMBERS LIST" && (
          <div className="admin-workbench-data-entry">
            <div className="admin-card admin-workbench-section">
              <h2>Members List</h2>
              <div className="admin-toolbar" style={{ marginBottom: "0.75rem" }}>
                <span className="admin-meta">{filteredMembers.length} of {members.length} members</span>
                <MemberFilterWidget
                  filters={filters}
                  onFiltersChange={applyFilters}
                  fields={filterFields}
                />
                <button type="button" className="admin-btn" onClick={() => void loadMembers()} disabled={loading}>{loading ? "Loading..." : "Reload"}</button>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr><th>ID</th><th>Name</th><th>Address</th><th>City</th><th>Phone</th><th>Oil Co</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((m, i) => (
                      <tr key={m._id} onClick={() => setIndex(i)}>
                        <td>{m.memberNumber || "—"}</td>
                        <td>{m.firstName} {m.lastName}</td>
                        <td>{[m.addressLine1, m.addressLine2].filter(Boolean).join(", ") || "—"}</td>
                        <td>{m.city || "—"}</td>
                        <td>{m.phone || "—"}</td>
                        <td>{m.oilCompanyId?.name || "—"}</td>
                        <td><span className={`admin-pill${m.status === "active" ? " ok" : ""}`}>{m.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "MEMBER STATUS RPT" && (
          <div className="admin-workbench-data-entry">
            <div className="admin-card admin-workbench-section">
              <h2>Member Status Report</h2>
              <h3>Status Summary</h3>
              <div className="admin-stats">
                <div className="admin-stat"><strong>{stats.active}</strong><span>Active Members</span></div>
                <div className="admin-stat"><strong>{stats.inactive}</strong><span>Inactive Members</span></div>
                <div className="admin-stat"><strong>{members.filter((m) => (m.notes || "").toLowerCase().includes("prospect")).length}</strong><span>Prospective</span></div>
                <div className="admin-stat"><strong>{stats.total}</strong><span>Total Records</span></div>
              </div>
              <div className="admin-actions-row">
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() =>
                    openPrintPreview(
                      "Member Status Report",
                      brandedShell("Member Status Report", `<table><thead><tr><th>Member #</th><th>Name</th><th>Status</th><th>Workbench</th><th>City</th><th>Email</th></tr></thead><tbody>${filteredMembers
                        .map(
                          (m) =>
                            `<tr><td>${m.memberNumber || "—"}</td><td>${m.firstName} ${m.lastName}</td><td>${m.status}</td><td>${defaultWorkbenchMemberStatus(m)}</td><td>${m.city || "—"}</td><td>${m.email}</td></tr>`
                        )
                        .join("")}</tbody></table>`),
                      true
                    )
                  }
                >
                  Print Report
                </button>
                <button type="button" className="admin-btn" onClick={() => generateMembersCsv("Member Status Report", filteredMembers)}>Export to Excel</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Worksheet" && (
          <div className="admin-workbench-data-entry">
            <div className="admin-card admin-workbench-section">
              <h2>Worksheet</h2>
              <h3>Search Results Spreadsheet View</h3>
              <p className="admin-readonly-hint">
                Displays the same row-style data as search results. Click any row to load that member in Data Entry.
              </p>
              <div className="admin-toolbar" style={{ marginBottom: "0.6rem", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", position: "relative" }}>
                  <button type="button" className="admin-btn" onClick={() => generateWorksheetCsv(worksheetMembers)}>
                    Export Worksheet to Excel
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-ghost"
                    onClick={() => setWorksheetColumnPickerOpen((v) => !v)}
                  >
                    Columns ({activeWorksheetColumns.length}/{WORKSHEET_COLUMNS.length})
                  </button>
                  {worksheetColumnPickerOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        marginTop: "0.35rem",
                        background: "var(--admin-card-bg, #fff)",
                        border: "1px solid var(--wb-border, #d1d5db)",
                        borderRadius: "6px",
                        boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
                        padding: "0.75rem",
                        zIndex: 50,
                        minWidth: "320px",
                        maxHeight: "440px",
                        overflowY: "auto",
                      }}
                    >
                      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.5rem" }}>
                        <button
                          type="button"
                          className="admin-btn admin-btn-ghost"
                          onClick={() => setWorksheetVisibleColumns(WORKSHEET_COLUMN_KEYS)}
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn-ghost"
                          onClick={() => setWorksheetVisibleColumns([])}
                        >
                          Deselect all
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn-ghost"
                          onClick={() => setWorksheetColumnPickerOpen(false)}
                          style={{ marginLeft: "auto" }}
                        >
                          Close
                        </button>
                      </div>
                      {Array.from(
                        WORKSHEET_COLUMNS.reduce((acc, c) => {
                          const list = acc.get(c.group) || [];
                          list.push(c);
                          acc.set(c.group, list);
                          return acc;
                        }, new Map<string, WorksheetColumn[]>())
                      ).map(([group, cols]) => (
                        <div key={group} style={{ marginBottom: "0.6rem" }}>
                          <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.25rem" }}>
                            {group}
                          </div>
                          {cols.map((c) => {
                            const checked = worksheetVisibleColumns.includes(c.key);
                            return (
                              <label key={c.key} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", padding: "0.15rem 0" }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    setWorksheetVisibleColumns((prev) => {
                                      if (e.target.checked) {
                                        if (prev.includes(c.key)) return prev;
                                        const next = WORKSHEET_COLUMN_KEYS.filter((k) => prev.includes(k) || k === c.key);
                                        return next;
                                      }
                                      return prev.filter((k) => k !== c.key);
                                    });
                                  }}
                                />
                                {c.label}
                              </label>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.35rem", alignItems: "center", flexWrap: "wrap" }}>
                  <span className="admin-meta">
                    {worksheetMembers.length} member(s) • Page {Math.min(worksheetPage, worksheetTotalPages)} of {worksheetTotalPages}
                  </span>
                  <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setWorksheetPage(1)} disabled={worksheetPage <= 1}>First</button>
                  <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setWorksheetPage((p) => Math.max(1, p - 1))} disabled={worksheetPage <= 1}>Prev</button>
                  <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setWorksheetPage((p) => Math.min(worksheetTotalPages, p + 1))} disabled={worksheetPage >= worksheetTotalPages}>Next</button>
                  <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setWorksheetPage(worksheetTotalPages)} disabled={worksheetPage >= worksheetTotalPages}>Last</button>
                </div>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      {activeWorksheetColumns.map((c) => {
                        const isSorted = worksheetSort.key === c.key;
                        return (
                          <th key={c.key}>
                            <button
                              type="button"
                              className="admin-btn admin-btn-ghost"
                              onClick={() => toggleWorksheetSort(c.key)}
                              title={`Sort by ${c.label}`}
                            >
                              {c.label}
                              {isSorted ? (worksheetSort.dir === "asc" ? " ▲" : " ▼") : ""}
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {worksheetPageRows.map((m) => {
                      const rowActive = current?._id === m._id;
                      return (
                        <tr
                          key={m._id}
                          onClick={() => {
                            const gi = members.findIndex((x) => x._id === m._id);
                            if (gi >= 0) setIndex(gi);
                            setActiveTab("Data Entry");
                          }}
                          style={{ cursor: "pointer", background: rowActive ? "rgba(194, 65, 12, 0.06)" : undefined }}
                        >
                          {activeWorksheetColumns.map((c) => {
                            if (c.key === "status") {
                              return (
                                <td key={c.key}>
                                  <span className={`admin-pill${m.status === "active" ? " ok" : ""}`}>{m.status}</span>
                                </td>
                              );
                            }
                            const v = c.get(m);
                            return (
                              <td key={c.key} style={{ fontWeight: 600 }}>{v || "—"}</td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {worksheetPageRows.length === 0 && (
                <p className="admin-meta" style={{ marginTop: "0.75rem" }}>No members match the current search/filter.</p>
              )}
              {activeWorksheetColumns.length === 0 && (
                <p className="admin-meta" style={{ marginTop: "0.75rem" }}>No columns selected. Use the Columns button to choose what to display.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === "PRINT FULL RECORD" && (
          <div className="admin-workbench-data-entry">
            <div className="admin-card admin-workbench-section">
              <h2>Print Full Record</h2>
              <h3>Print Options</h3>
              <div className="admin-checkbox-grid">
                <label>
                  <input type="checkbox" checked={legacyBool("printIncludeContact")} onChange={(e) => setLegacy("printIncludeContact", e.target.checked)} disabled={!current} />
                  Include Contact Information
                </label>
                <label>
                  <input type="checkbox" checked={legacyBool("printIncludePayment")} onChange={(e) => setLegacy("printIncludePayment", e.target.checked)} disabled={!current} />
                  Include Payment History
                </label>
                <label>
                  <input type="checkbox" checked={legacyBool("printIncludeDelivery")} onChange={(e) => setLegacy("printIncludeDelivery", e.target.checked)} disabled={!current} />
                  Include Delivery History
                </label>
                <label>
                  <input type="checkbox" checked={legacyBool("printIncludeNotes")} onChange={(e) => setLegacy("printIncludeNotes", e.target.checked)} disabled={!current} />
                  Include Notes
                </label>
              </div>
              <div className="admin-actions-row">
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  disabled={!current}
                  onClick={() => {
                    if (!current) return;
                    openPrintPreview("Full Member Record", brandedShell("Full Member Record", `<pre>${escHtml(memberRecordText(current))}</pre>`), true);
                  }}
                >
                  Print Record
                </button>
                <button
                  type="button"
                  className="admin-btn"
                  disabled={!current}
                  onClick={() => {
                    if (!current) return;
                    openPrintPreview("Full Member Record Preview", brandedShell("Full Member Record Preview", `<pre>${escHtml(memberRecordText(current))}</pre>`));
                  }}
                >
                  Preview
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "RUN BACKUP" && (
          <div className="admin-workbench-data-entry">
            <div className="admin-card admin-workbench-section">
              <h2>Run Backup</h2>
              <h3>Database Backup</h3>
              <p className="admin-readonly-hint">Scheduled backups are environment-specific. Buttons mirror the legacy workbench; connect to your host backup flow when ready.</p>
              <div className="admin-form-grid">
                <label className="admin-form-span-2">Last Backup<input className="admin-input" value={legacyValue("backupLastAt")} onChange={(e) => setLegacy("backupLastAt", e.target.value)} placeholder="e.g. February 15, 2026 3:45 PM" /></label>
                <label className="admin-form-span-2">Backup Location<input className="admin-input" value={legacyValue("backupPath")} onChange={(e) => setLegacy("backupPath", e.target.value)} placeholder="/backups/…" /></label>
              </div>
              <div className="admin-actions-row">
                <button type="button" className="admin-btn admin-btn-primary" onClick={runBackupNow}>Run Backup Now</button>
                <button type="button" className="admin-btn" onClick={scheduleBackup}>Schedule Backup</button>
              </div>
              <h3>Backup History</h3>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Date</th><th>Size</th><th>Status</th></tr></thead>
                  <tbody>
                    {backupHistory.length === 0 ? (
                      <tr><td colSpan={3}>No backup events yet.</td></tr>
                    ) : (
                      backupHistory.map((b) => (
                        <tr key={b.id}>
                          <td>{new Date(b.at).toLocaleString()}</td>
                          <td>{b.sizeBytes ? `${(b.sizeBytes / 1024).toFixed(1)} KB` : "scheduled"}</td>
                          <td>{b.type === "manual" ? "Completed" : "Scheduled"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "OIL CO FORM" && (
          <div className="admin-workbench-data-entry">
            <div className="admin-card admin-workbench-section">
              <h2>Oil Co Form</h2>
              <div className="admin-actions-row" style={{ marginBottom: "1rem" }}>
                <button type="button" className="admin-wb-btn admin-wb-btn-primary" onClick={startAddOilCo}>
                  Add Oil Company
                </button>
              </div>

              {(showAddOilCo || editingOilCo) && (
                <div className="admin-wb-panel" style={{ marginBottom: "1rem" }}>
                  <div className="admin-wb-panel-title">{editingOilCo ? "Edit Oil Company" : "Add Oil Company"}</div>
                  <div className="admin-form-grid-4">
                    <label className="admin-form-span-2">
                      Company Name *
                      <input
                        className="admin-input"
                        value={oilCoForm.name}
                        onChange={(e) => setOilCoForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Enter company name"
                      />
                    </label>
                    <label>
                      Phone
                      <input
                        className="admin-input"
                        value={oilCoForm.contactPhone}
                        onChange={(e) => setOilCoForm((f) => ({ ...f, contactPhone: e.target.value }))}
                        placeholder="(555) 555-5555"
                      />
                    </label>
                    <label>
                      Email
                      <input
                        className="admin-input"
                        type="email"
                        value={oilCoForm.contactEmail}
                        onChange={(e) => setOilCoForm((f) => ({ ...f, contactEmail: e.target.value }))}
                        placeholder="contact@company.com"
                      />
                    </label>
                    <label className="admin-form-span-4 admin-note-field">
                      Notes
                      <textarea
                        className="admin-input admin-note-input"
                        value={oilCoForm.notes}
                        onChange={(e) => setOilCoForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder="Internal notes about this company..."
                      />
                    </label>
                  </div>
                  <div className="admin-actions-row" style={{ marginTop: "0.75rem" }}>
                    <button
                      type="button"
                      className="admin-wb-btn admin-wb-btn-success"
                      onClick={saveOilCompany}
                      disabled={!oilCoForm.name.trim()}
                    >
                      {editingOilCo ? "Update Company" : "Add Company"}
                    </button>
                    <button type="button" className="admin-wb-btn admin-wb-btn-secondary" onClick={cancelOilCoEdit}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <h3>Oil Company Information</h3>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Code</th><th>Company Name</th><th>Phone</th><th>Contact</th><th>Actions</th></tr></thead>
                  <tbody>
                    {oilCompanies.map((oc) => (
                      <tr key={oc._id}>
                        <td>{oilCoDisplayCode(oc)}</td>
                        <td>{oc.name}</td>
                        <td>{oc.contactPhone || "—"}</td>
                        <td>{oc.contactEmail || "—"}</td>
                        <td>
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button
                              type="button"
                              className="admin-wb-btn admin-wb-btn-secondary"
                              style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}
                              onClick={() => startEditOilCo(oc)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="admin-wb-btn admin-wb-btn-danger"
                              style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}
                              onClick={() => deleteOilCompany(oc._id, oc.name)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "REFUND LETTER" && (
          <div className="admin-workbench-data-entry">
            <div className="admin-card admin-workbench-section">
              <h2>Refund Letter</h2>
              <h3>Generate Refund Letter</h3>
              <div className="admin-form-grid">
                <label>Member Name<input className="admin-input" value={legacyValue("refundMemberName")} onChange={(e) => setLegacy("refundMemberName", e.target.value)} placeholder={current ? `${current.firstName} ${current.lastName}` : ""} disabled={!current} /></label>
                <label>Refund Amount<input className="admin-input" value={legacyValue("refundAmount")} onChange={(e) => setLegacy("refundAmount", e.target.value)} disabled={!current} /></label>
                <label className="admin-form-span-2 admin-note-field">
                  Reason for Refund
                  <textarea className="admin-input admin-note-input" value={legacyValue("refundReason")} onChange={(e) => setLegacy("refundReason", e.target.value)} disabled={!current} />
                </label>
              </div>
              <p className="admin-readonly-hint" style={{ margin: "0 0 0.75rem" }}>
                Printed letters use the official letterhead. If you email this notice instead, use Preview Email to see the forest-green COOP banner format.
              </p>
              <div className="admin-actions-row">
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  disabled={!current}
                  onClick={() => {
                    if (!current) return;
                    const html = refundLetterHtml();
                    downloadText(`refund-letter-${current.memberNumber || current._id}-${fileNameStamp()}.html`, html, "text/html;charset=utf-8");
                    setActionMessage("Refund letter HTML generated.");
                  }}
                >
                  Generate Letter
                </button>
                <button
                  type="button"
                  className="admin-btn"
                  disabled={!current}
                  onClick={() => {
                    if (!current) return;
                    openPrintPreview("Refund Email Preview", wrapEmailPreview(plainTextToEmailMiddle(refundLetterBody())), false, false, "email");
                  }}
                >
                  Preview Email
                </button>
                <button
                  type="button"
                  className="admin-btn"
                  disabled={!current}
                  onClick={() => {
                    if (!current) return;
                    openPrintPreview("Refund Letter Preview", refundLetterHtml(), false, false, "letter");
                  }}
                >
                  Preview Letter
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "START DATE LETTER" && (
          <div className="admin-workbench-data-entry">
            <div className="admin-card admin-workbench-section">
              <h2>Start Date Letter</h2>
              <h3>Generate Start Date Letter</h3>
              <div className="admin-form-grid">
                <label>Member Name<input className="admin-input" value={legacyValue("startLetterMemberName")} onChange={(e) => setLegacy("startLetterMemberName", e.target.value)} placeholder={current ? `${current.firstName} ${current.lastName}` : ""} disabled={!current} /></label>
                <label>Start Date<input className="admin-input" value={legacyValue("startLetterStartDate")} onChange={(e) => setLegacy("startLetterStartDate", e.target.value)} disabled={!current} /></label>
              </div>
              <p className="admin-readonly-hint" style={{ margin: "0 0 0.75rem" }}>
                Printed letters use the official letterhead. If you email this notice instead, use Preview Email to see the forest-green COOP banner format.
              </p>
              <div className="admin-actions-row">
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  disabled={!current}
                  onClick={() => {
                    if (!current) return;
                    const html = startDateLetterHtml();
                    downloadText(`start-date-letter-${current.memberNumber || current._id}-${fileNameStamp()}.html`, html, "text/html;charset=utf-8");
                    setActionMessage("Start date letter HTML generated.");
                  }}
                >
                  Generate Letter
                </button>
                <button
                  type="button"
                  className="admin-btn"
                  disabled={!current}
                  onClick={() => {
                    if (!current) return;
                    openPrintPreview("Start Date Email Preview", wrapEmailPreview(plainTextToEmailMiddle(startDateLetterBody())), false, false, "email");
                  }}
                >
                  Preview Email
                </button>
                <button
                  type="button"
                  className="admin-btn"
                  disabled={!current}
                  onClick={() => {
                    if (!current) return;
                    openPrintPreview("Start Date Letter Preview", startDateLetterHtml(), false, false, "letter");
                  }}
                >
                  Preview Letter
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Multiple Referral Letter" && (
          <div className="admin-workbench-data-entry">
            <div className="admin-card admin-workbench-section">
              <h2>Multiple Referral Letter</h2>
              <h3>Generate Multiple Referral Letters</h3>
              <p className="admin-readonly-hint">Select members from the list below (click rows on Members List or use current filter). Generation is not wired yet.</p>
              <label className="admin-form-span-2 admin-note-field">
                Select Members (preview)
                <textarea className="admin-input admin-note-input" readOnly value={members.slice(0, 8).map((m) => `${m.firstName} ${m.lastName}`).join("\n")} />
              </label>
              <div className="admin-actions-row">
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => {
                    const rows = filteredMembers.slice(0, 50);
                    const letters = rows
                      .map((m) =>
                        previewLetterHtml(
                          `Thank you for your referrals to Oil Co-op.\n\nMember #: ${m.memberNumber || "—"}`,
                          {
                            firstName: m.firstName,
                            lastName: m.lastName,
                            address: m.addressLine1,
                            cityStateZip: [m.city, m.state, m.postalCode].filter(Boolean).join(" "),
                          }
                        )
                      )
                      .join("<div style='page-break-after:always'></div>");
                    downloadText(`multiple-referral-letters-${fileNameStamp()}.html`, letters || brandedShell("Referral Letters", "<p>No members selected.</p>"), "text/html;charset=utf-8");
                    setActionMessage(`Generated ${rows.length} referral letter draft(s).`);
                  }}
                >
                  Generate Letters
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Renewal Mailing" && (
          <div className="admin-workbench-data-entry">
            <div className="admin-card admin-workbench-section">
              <h2>Renewal Mailing</h2>
              <h3>Generate Renewal Mailing</h3>
              <div className="admin-form-grid">
                <label>
                  Billing Year
                  <select className="admin-input" value={legacyValue("renewalBillingYear") || String(new Date().getFullYear())} onChange={(e) => setLegacy("renewalBillingYear", e.target.value)}>
                    <option value={String(new Date().getFullYear())}>{new Date().getFullYear()}</option>
                    <option value={String(new Date().getFullYear() - 1)}>{new Date().getFullYear() - 1}</option>
                  </select>
                </label>
                <label>Mailing Date<input className="admin-input" value={legacyValue("renewalMailingDate")} onChange={(e) => setLegacy("renewalMailingDate", e.target.value)} /></label>
                <div className="admin-checkbox-grid">
                  <label>
                    <input type="checkbox" checked={legacyBool("renewalDueOnly")} onChange={(e) => setLegacy("renewalDueOnly", e.target.checked)} />
                    Include members due for renewal
                  </label>
                  <label>
                    <input type="checkbox" checked={legacyBool("renewalIncludeLifetime")} onChange={(e) => setLegacy("renewalIncludeLifetime", e.target.checked)} />
                    Include lifetime members
                  </label>
                </div>
              </div>
              <div className="admin-actions-row">
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => {
                    const rows = members.filter((m) => m.status === "active");
                    generateMembersCsv("Renewal Mailing", rows);
                  }}
                >
                  Generate Mailing
                </button>
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() =>
                    openPrintPreview(
                      "Renewal Mailing List Preview",
                      brandedShell("Renewal Mailing List", `<p>Billing Year: ${escHtml(legacyValue("renewalBillingYear") || new Date().getFullYear())}</p><table><thead><tr><th>Member #</th><th>Name</th><th>Email</th><th>Status</th></tr></thead><tbody>${members
                        .filter((m) => m.status === "active")
                        .map((m) => `<tr><td>${m.memberNumber || "—"}</td><td>${m.firstName} ${m.lastName}</td><td>${m.email}</td><td>${m.status}</td></tr>`)
                        .join("")}</tbody></table>`)
                    )
                  }
                >
                  Preview List
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Prospective Mailing" && (
          <div className="admin-workbench-data-entry">
            <div className="admin-card admin-workbench-section">
              <h2>Prospective Mailing</h2>
              <h3>Generate Prospective Member Mailing</h3>
              <div className="admin-form-grid">
                <label>Mailing Date<input className="admin-input" value={legacyValue("prospectiveMailingDate")} onChange={(e) => setLegacy("prospectiveMailingDate", e.target.value)} /></label>
                <label>
                  Target Audience
                  <select className="admin-input" value={legacyValue("prospectiveAudience") || "prospective"} onChange={(e) => setLegacy("prospectiveAudience", e.target.value)}>
                    <option value="prospective">Prospective Members</option>
                    <option value="inquiries">Recent Inquiries</option>
                    <option value="referrals">Referrals</option>
                  </select>
                </label>
              </div>
              <div className="admin-actions-row">
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => generateMembersCsv("Prospective Mailing", members.filter((m) => defaultWorkbenchMemberStatus(m) === "PROSPECTIVE"))}
                >
                  Generate Mailing
                </button>
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() =>
                    openPrintPreview(
                      "Prospective Mailing List Preview",
                      brandedShell("Prospective Mailing List", `<table><thead><tr><th>Member #</th><th>Name</th><th>Email</th><th>City</th></tr></thead><tbody>${members
                        .filter((m) => defaultWorkbenchMemberStatus(m) === "PROSPECTIVE")
                        .map((m) => `<tr><td>${m.memberNumber || "—"}</td><td>${m.firstName} ${m.lastName}</td><td>${m.email}</td><td>${m.city || "—"}</td></tr>`)
                        .join("")}</tbody></table>`)
                    )
                  }
                >
                  Preview List
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <DeliveryHistoryModal
        open={deliveryHistoryOpen}
        onClose={() => setDeliveryHistoryOpen(false)}
        member={deliveryModalMember}
        deliveries={deliveryRows}
        searchableMembers={members}
        oilCompanyOptions={oilCompanies}
        propaneCompanyOptions={propaneCompanies}
        isDirty={formIsDirty}
        isSaving={isSaving}
        onSave={async () => {
          await saveCurrent();
        }}
        onMemberPatch={(p) => {
          setForm((prev) => {
            const lp: Record<string, unknown> = { ...(prev.legacyProfile || {}) };
            const next: WorkbenchFormState = { ...prev };
            if (p.firstName !== undefined) next.firstName = p.firstName;
            if (p.lastName !== undefined) next.lastName = p.lastName;
            if (p.oilCoCode !== undefined) lp.oilCoCode = p.oilCoCode;
            if (p.oilCompanyName !== undefined) lp.oilCompanyName = p.oilCompanyName;
            if (p.oilId !== undefined) lp.oilId = p.oilId;
            if (p.oilStatus !== undefined) lp.oilWorkbenchStatus = p.oilStatus;
            if (p.propCoCode !== undefined) lp.propCoCode = p.propCoCode;
            if (p.propaneCompanyName !== undefined) lp.propaneCompanyName = p.propaneCompanyName;
            if (p.propaneId !== undefined) lp.propaneId = p.propaneId;
            if (p.propaneStatus !== undefined) lp.propaneStatus = p.propaneStatus;
            if (p.deliveryHistory !== undefined) lp.deliveryHistory = p.deliveryHistory;
            if (p.delinquent !== undefined) lp.delinquent = p.delinquent;
            if (p.notPaidCurrentYr !== undefined) lp.notPaidCurrentYr = p.notPaidCurrentYr;
            if (p.nrdOil !== undefined) lp.nrdOil = p.nrdOil;
            if (p.nrdProp !== undefined) lp.nrdProp = p.nrdProp;
            next.legacyProfile = lp;
            formRef.current = next;
            return next;
          });
        }}
        onAddDelivery={
          current && token
            ? async (d) => {
                const r = await api<{ rows: DeliveryHistoryRow[] }>(
                  `/api/admin/deliveries/members/${current._id}`,
                  { method: "POST", token, body: JSON.stringify(d) }
                );
                applyDeliveryRows(r.rows);
                return r.rows;
              }
            : undefined
        }
        onUpdateDelivery={
          current && token
            ? async (rowId, d) => {
                const r = await api<{ rows: DeliveryHistoryRow[] }>(
                  `/api/admin/deliveries/members/${current._id}/${rowId}`,
                  { method: "PUT", token, body: JSON.stringify(d) }
                );
                applyDeliveryRows(r.rows);
                return r.rows;
              }
            : undefined
        }
        onDeleteDelivery={
          current && token
            ? async (rowId) => {
                const r = await api<{ rows: DeliveryHistoryRow[] }>(
                  `/api/admin/deliveries/members/${current._id}/${rowId}`,
                  { method: "DELETE", token }
                );
                applyDeliveryRows(r.rows);
                return r.rows;
              }
            : undefined
        }
      />

      <PaymentFindModal
        open={paymentFindOpen}
        onClose={() => setPaymentFindOpen(false)}
        members={members}
        oilCompanyOptions={oilCompanies}
        selectedMemberId={current?._id ?? null}
        onSelectMember={(id) => {
          selectMemberById(id);
          setPaymentFindOpen(false);
        }}
        onEmailResults={(ids) => {
          setBulkAudienceIds(ids);
          setActiveTab("MAILINGS");
          setPaymentFindOpen(false);
          setActionMessage(`Loaded ${ids.length} found members as the mailing audience — compose your message and send.`);
        }}
        onGenerateInvoices={(ids, pastDue) => {
          const set = new Set(ids);
          generateInvoicesFor(members.filter((m) => set.has(m._id)), pastDue);
          setPaymentFindOpen(false);
        }}
      />
    </div>
  );
}
