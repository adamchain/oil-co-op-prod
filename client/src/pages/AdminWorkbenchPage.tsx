import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../authContext";
import { stateSynonyms } from "../utils/stateAbbreviations";

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

type OilCompany = { _id: string; name: string; contactEmail?: string; contactPhone?: string; notes?: string };
type BillingEvent = { _id: string; kind: string; status: string; amountCents: number; billingYear?: number; createdAt: string };
type Comm = { _id: string; channel: string; subject?: string; status: string; createdAt: string };
type Referral = { referrerMemberId?: { firstName?: string; lastName?: string; email?: string } };
type NoteEntry = { _id?: string; text: string; createdAt: string; createdBy: string };

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
const HOW_JOINED = ["PHO", "WEB", "REF", "MAIL"] as const;
const REFERRAL_SOURCE = ["CCAG", "MEMBER", "OTHER"] as const;
const MAILING_TEMPLATES = {
  newMember: {
    label: "NEW MEMBER LETTER",
    subject: "Welcome to Citizen's Oil Co-op",
    body:
      "Dear {memberName},\n\nThank you for joining the Citizen's Oil Co-op.\n\n" +
      "We have forwarded your name and address to the oil company servicing your area.\n" +
      "You will be entered in as an Oil Co-op member and receive discounted pricing.\n\n" +
      "The oil company working with Citizen's Oil Co-op in your area is:\n{companyName}\n\n" +
      "Address on file:\n{address}\n{cityStateZip}\n\n" +
      "Please let us know if we can be of additional assistance.",
  },
  renewalReminder: {
    label: "RENEWAL REMINDER",
    subject: "Annual Membership Renewal Reminder",
    body:
      "Dear {memberName},\n\nThis is a reminder that your annual membership is due soon.\n\n" +
      "Member ID: {memberNumber}\nAddress: {address}\nCity/State/Zip: {cityStateZip}\n\n" +
      "Please contact the office if you have questions.\n\nSincerely,\nOil Co-op Member Services",
  },
  prospective: {
    label: "PROSPECTIVE LETTER",
    subject: "Thank you for your interest in Citizen's Oil Co-op",
    body:
      "Dear {memberName},\n\nThank you for your interest in the Citizen's Oil Co-op.\n\n" +
      "We would be happy to assist you with enrollment and answer any questions.\n\n" +
      "Address on file:\n{address}\n{cityStateZip}\n\nSincerely,\nOil Co-op Member Services",
  },
  pastDue: {
    label: "PAST DUE REMINDER",
    subject: "Past Due Membership Reminder",
    body:
      "Dear {memberName},\n\nOur records indicate your membership payment may be past due.\n\n" +
      "Member ID: {memberNumber}\nPlease contact us to keep your membership active.\n\nSincerely,\nOil Co-op Member Services",
  },
  startupBill: {
    label: "STARTUP BILL",
    subject: "Startup Membership Bill",
    body:
      "Dear {memberName},\n\nThis letter confirms your startup membership billing details.\n\n" +
      "Member ID: {memberNumber}\nAddress:\n{address}\n{cityStateZip}\n\nSincerely,\nOil Co-op Member Services",
  },
  registrationReminder: {
    label: "REGISTRATION REMINDER",
    subject: "Registration Reminder",
    body:
      "Dear {memberName},\n\nThis is a reminder to complete your registration details for Citizen's Oil Co-op.\n\n" +
      "Please contact us if you need assistance.\n\nSincerely,\nOil Co-op Member Services",
  },
  custom: {
    label: "Letter Template",
    subject: "Member Notice",
    body: "Dear {memberName},\n\n{customMessage}\n\nSincerely,\nOil Co-op Member Services",
  },
} as const;

const DEFAULT_MAIL_HEADER = "Oil Co-op Administrative Office\nMember Services Workbench";
const DEFAULT_MAIL_FOOTER = "Sincerely,\nOil Co-op Member Services";

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

function nl2br(v: string): string {
  return escHtml(v).replace(/\n/g, "<br>");
}

function formatPhoneValue(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return raw.trim();
}

export default function AdminWorkbenchPage() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const memberParam = searchParams.get("member") ?? "";
  const missingMemberFetchAttempt = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>("Data Entry");
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [statusFilter, setStatusFilter] = useState("all");
  const [oilCoFilterId, setOilCoFilterId] = useState("");
  const [flagFilter, setFlagFilter] = useState("");
  const [worksheetSort, setWorksheetSort] = useState<{ key: "memberNumber" | "name" | "address" | "city" | "phone" | "oilCompany" | "notes" | "status"; dir: "asc" | "desc" }>({
    key: "name",
    dir: "asc",
  });
  const [worksheetPage, setWorksheetPage] = useState(1);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [oilCompanies, setOilCompanies] = useState<OilCompany[]>([]);
  const [billing, setBilling] = useState<BillingEvent[]>([]);
  const [communications, setCommunications] = useState<Comm[]>([]);
  const [referral, setReferral] = useState<Referral | null>(null);

  // Oil Company editing state
  const [editingOilCo, setEditingOilCo] = useState<OilCompany | null>(null);
  const [oilCoForm, setOilCoForm] = useState({ name: "", contactEmail: "", contactPhone: "", notes: "" });
  const [showAddOilCo, setShowAddOilCo] = useState(false);

  // Notes state
  const [newNote, setNewNote] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [backupHistory, setBackupHistory] = useState<BackupHistoryEntry[]>([]);
  const [mailTemplateKey, setMailTemplateKey] = useState<keyof typeof MAILING_TEMPLATES>("newMember");
  const [mailSubject, setMailSubject] = useState<string>(MAILING_TEMPLATES.newMember.subject);
  const [mailBody, setMailBody] = useState<string>(MAILING_TEMPLATES.newMember.body);
  const [mailHeader, setMailHeader] = useState<string>(DEFAULT_MAIL_HEADER);
  const [mailFooter, setMailFooter] = useState<string>(DEFAULT_MAIL_FOOTER);
  const [mailToEmail, setMailToEmail] = useState("");
  const [mailSending, setMailSending] = useState(false);

  const [form, setForm] = useState({
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
    legacyProfile: {} as Record<string, unknown>,
  });

  async function loadMembers() {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (statusFilter === "active") params.set("status", "active");
      if (statusFilter === "inactive") params.set("status", "expired");
      if (oilCoFilterId) params.set("oilCompanyId", oilCoFilterId);
      if (flagFilter) params.set("flag", flagFilter);
      const path = `/api/admin/members${params.size ? `?${params.toString()}` : ""}`;
      const { members: rows } = await api<{ members: Member[] }>(path, { token });
      setMembers(rows);
      setIndex(0);
    } finally {
      setLoading(false);
    }
  }

  async function loadOilCompanies() {
    if (!token) return;
    const { oilCompanies: rows } = await api<{ oilCompanies: OilCompany[] }>("/api/admin/oil-companies", { token });
    setOilCompanies(rows);
  }

  useEffect(() => {
    const qq = searchParams.get("q") || "";
    setSearch(qq);
  }, [searchParams]);

  useEffect(() => {
    void loadOilCompanies();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /** Reload list when URL query changes (global search) or status filter changes — not on every local keystroke. */
  useEffect(() => {
    void loadMembers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, statusFilter, searchParams, oilCoFilterId, flagFilter]);

  useEffect(() => {
    missingMemberFetchAttempt.current = null;
  }, [memberParam]);

  /** Select member from `?member=` or load that record if it is outside the current result set. */
  useEffect(() => {
    if (!token || !memberParam || loading) return;
    if (members.some((m) => m._id === memberParam)) {
      const i = members.findIndex((m) => m._id === memberParam);
      if (i >= 0) setIndex(i);
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
  }, [token, memberParam, loading, members]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("workbench.backupHistory");
      const parsed = raw ? (JSON.parse(raw) as BackupHistoryEntry[]) : [];
      setBackupHistory(Array.isArray(parsed) ? parsed : []);
    } catch {
      setBackupHistory([]);
    }
  }, []);

  const current = members[index] || null;

  useEffect(() => {
    if (!token || !current) {
      setBilling([]);
      setCommunications([]);
      setReferral(null);
      return;
    }
    const lp = { ...(current.legacyProfile || {}) } as Record<string, unknown>;
    if (typeof lp.workbenchMemberStatus !== "string" || !lp.workbenchMemberStatus) {
      lp.workbenchMemberStatus = defaultWorkbenchMemberStatus({ ...current, legacyProfile: lp });
    }
    setForm({
      firstName: current.firstName || "",
      lastName: current.lastName || "",
      email: current.email || "",
      phone: current.phone || "",
      addressLine1: current.addressLine1 || "",
      addressLine2: current.addressLine2 || "",
      city: current.city || "",
      state: current.state || "",
      postalCode: current.postalCode || "",
      notes: current.notes || "",
      oilCompanyId: current.oilCompanyId?._id || "",
      legacyProfile: lp,
    });
    api<{ billing: BillingEvent[]; communications: Comm[]; referral: Referral | null }>(
      `/api/admin/members/${current._id}`,
      { token }
    ).then((r) => {
      setBilling(r.billing || []);
      setCommunications(r.communications || []);
      setReferral(r.referral || null);
    });
  }, [current?._id, token]);

  const stats = useMemo(() => {
    const active = members.filter((m) => m.status === "active").length;
    const inactive = members.filter((m) => m.status !== "active").length;
    return { active, inactive, total: members.length };
  }, [members]);

  useEffect(() => {
    const tpl = MAILING_TEMPLATES[mailTemplateKey];
    setMailSubject(tpl.subject);
    setMailBody(tpl.body);
  }, [mailTemplateKey]);

  useEffect(() => {
    setMailToEmail(current?.email || "");
  }, [current?.email]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      const ws = defaultWorkbenchMemberStatus(m);
      const statusOk =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
            ? m.status === "active"
            : statusFilter === "inactive"
              ? m.status !== "active"
              : ws === "PROSPECTIVE";
      if (!statusOk) return false;
      if (oilCoFilterId && m.oilCompanyId?._id !== oilCoFilterId) return false;
      if (flagFilter) {
        const lp = (m.legacyProfile && typeof m.legacyProfile === "object")
          ? (m.legacyProfile as Record<string, unknown>)
          : {};
        if (flagFilter === "waived") {
          const status = String(lp.registrationPaymentStatus || "").toLowerCase();
          if (!lp.waiveFeeSenior && status !== "waived") return false;
        } else if (!lp[flagFilter]) {
          return false;
        }
      }
      if (!q) return true;
      const legacyValues =
        m.legacyProfile && typeof m.legacyProfile === "object"
          ? Object.values(m.legacyProfile as Record<string, unknown>)
          : [];
      return [
        m.memberNumber,
        m.firstName,
        m.lastName,
        m.email,
        m.phone,
        m.addressLine1,
        m.addressLine2,
        m.city,
        m.state,
        ...stateSynonyms(m.state),
        m.postalCode,
        m.notes,
        ...legacyValues,
      ]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q));
    });
  }, [members, search, statusFilter, oilCoFilterId, flagFilter]);

  const worksheetMembers = useMemo(() => {
    const getValue = (m: Member, key: "memberNumber" | "name" | "address" | "city" | "phone" | "oilCompany" | "notes" | "status") => {
      switch (key) {
        case "memberNumber":
          return m.memberNumber || "";
        case "name":
          return `${m.firstName || ""} ${m.lastName || ""}`.trim();
        case "address":
          return [m.addressLine1, m.addressLine2].filter(Boolean).join(", ");
        case "city":
          return m.city || "";
        case "phone":
          return m.phone || "";
        case "oilCompany":
          return m.oilCompanyId?.name || "";
        case "notes":
          return m.notes || "";
        case "status":
          return m.status || "";
        default:
          return "";
      }
    };
    const out = [...filteredMembers];
    out.sort((a, b) => {
      const av = getValue(a, worksheetSort.key).toLowerCase();
      const bv = getValue(b, worksheetSort.key).toLowerCase();
      const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
      return worksheetSort.dir === "asc" ? cmp : -cmp;
    });
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
  }, [search, statusFilter, oilCoFilterId, flagFilter, worksheetSort]);

  useEffect(() => {
    setWorksheetPage((p) => Math.min(p, worksheetTotalPages));
  }, [worksheetTotalPages]);

  function toggleWorksheetSort(key: "memberNumber" | "name" | "address" | "city" | "phone" | "oilCompany" | "notes" | "status") {
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

  const recordCount = `${members.length ? index + 1 : 0}`;

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

  const openPrintPreview = (title: string, body: string, triggerPrint = false) => {
    const w = window.open("", "_blank", "width=960,height=720");
    if (!w) {
      setActionMessage("Popup blocked. Please allow popups for print preview.");
      return;
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(title)}</title><style>body{font-family:Arial,sans-serif;padding:24px;line-height:1.4}h1{margin-top:0;font-size:20px}table{border-collapse:collapse;width:100%;margin-top:12px}th,td{border:1px solid #ddd;padding:6px;font-size:12px;text-align:left}th{background:#f6f6f6}pre{white-space:pre-wrap;font-family:inherit}</style></head><body>${body}</body></html>`;
    try {
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch {
      // Fallback for browsers that restrict direct document writes on new tabs/windows.
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

  const brandedLetterHtml = (
    subject: string,
    recipientName: string,
    bodyText: string,
    options?: { brandTitle?: string; brandSubtitle?: string; footerText?: string }
  ) =>
    brandedShell(
      subject,
      `
      <div style="font-size:13px;color:#111827">
        <p style="margin:0 0 10px">${new Date().toLocaleDateString()}</p>
        <p style="margin:0 0 12px">${escHtml(recipientName || "Member")}</p>
        <p style="margin:0 0 14px;white-space:normal;line-height:1.55">${nl2br(bodyText)}</p>
        <p style="margin:20px 0 0;white-space:normal;line-height:1.55">${nl2br(options?.footerText || DEFAULT_MAIL_FOOTER)}</p>
      </div>
      `,
      { brandTitle: options?.brandTitle, brandSubtitle: options?.brandSubtitle }
    );

  const nav = (kind: "first" | "prev" | "next" | "last") => {
    if (!members.length) return;
    if (kind === "first") setIndex(0);
    if (kind === "last") setIndex(members.length - 1);
    if (kind === "prev") setIndex((i) => Math.max(0, i - 1));
    if (kind === "next") setIndex((i) => Math.min(members.length - 1, i + 1));
  };

  const saveCurrent = async () => {
    if (!token || !current) return;
    const ws = String(form.legacyProfile.workbenchMemberStatus ?? "ACTIVE");
    const status = workbenchStatusToApiStatus(ws);
    const legacyProfile = { ...form.legacyProfile } as Record<string, unknown>;
    const newMemberDt = String(legacyProfile.newMemberDt ?? "").trim();
    if (newMemberDt) legacyProfile.oilStartDate = newMemberDt;
    await api(`/api/admin/members/${current._id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ ...form, legacyProfile, status }),
    });
    await loadMembers();
  };

  const setLegacy = (key: string, value: string | boolean) =>
    setForm((f) => {
      const nextLegacy = { ...f.legacyProfile, [key]: value } as Record<string, unknown>;
      if (key === "newMemberDt") {
        nextLegacy.oilStartDate = String(value ?? "");
      }
      return { ...f, legacyProfile: nextLegacy };
    });

  const legacyValue = (key: string) => String(form.legacyProfile[key] ?? "");

  const legacyBool = (key: string) => Boolean(form.legacyProfile[key]);

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
    downloadCsv(
      `worksheet-${fileNameStamp()}.csv`,
      ["Member #", "Name", "Address", "City", "State", "Zip", "Phone", "Oil Company", "Notes", "Status"],
      rows.map((m) => [
        m.memberNumber || "",
        `${m.firstName || ""} ${m.lastName || ""}`.trim(),
        [m.addressLine1, m.addressLine2].filter(Boolean).join(", "),
        m.city || "",
        m.state || "",
        m.postalCode || "",
        m.phone || "",
        m.oilCompanyId?.name || "",
        m.notes || "",
        m.status || "",
      ])
    );
    setActionMessage(`Worksheet export generated (${rows.length} rows).`);
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
  const mailingMergeData = {
    memberName: memberDisplayName || "Member",
    memberNumber: current?.memberNumber || "—",
    address: [current?.addressLine1, current?.addressLine2].filter(Boolean).join(", ") || "—",
    cityStateZip: [current?.city, current?.state, current?.postalCode].filter(Boolean).join(" ").trim() || "—",
    companyName: current?.oilCompanyId?.name || "Assigned Oil Company",
    email: current?.email || "—",
    phone: current?.phone || "—",
    customMessage: "Please update this message before printing.",
  };

  const applyMailMerge = (template: string) =>
    template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_m, key: string) =>
      String((mailingMergeData as Record<string, string>)[key] ?? "")
    );

  const mergedHeader = applyMailMerge(mailHeader);
  const mergedHeaderLines = mergedHeader.split("\n").map((s) => s.trim()).filter(Boolean);
  const mailingBrandTitle = mergedHeaderLines[0] || "Oil Co-op Administrative Office";
  const mailingBrandSubtitle = mergedHeaderLines.slice(1).join(" ") || "Member Services Workbench";
  const mailingPreviewHtml = brandedLetterHtml(
    applyMailMerge(mailSubject),
    mailingMergeData.memberName,
    applyMailMerge(mailBody),
    {
      brandTitle: mailingBrandTitle,
      brandSubtitle: mailingBrandSubtitle,
      footerText: applyMailMerge(mailFooter),
    }
  );

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
          subject: applyMailMerge(mailSubject),
          body: applyMailMerge(mailBody),
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

  const refundLetterHtml = () =>
    brandedLetterHtml(
      "Refund Letter",
      legacyValue("refundMemberName") || memberDisplayName,
      `We are issuing a refund in the amount of $${legacyValue("refundAmount") || "0.00"}.\n\nReason:\n${legacyValue("refundReason") || "No reason provided."}`
    );

  const startDateLetterHtml = () =>
    brandedLetterHtml(
      "Start Date Letter",
      legacyValue("startLetterMemberName") || memberDisplayName,
      `Welcome to Oil Co-op.\n\nYour membership start date is: ${legacyValue("startLetterStartDate") || "TBD"}.\n\nPlease keep this letter for your records.`
    );


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
          <span className="admin-wb-count">Record {recordCount} of {members.length}</span>
        </div>
        <div className="admin-wb-header-right">
          <select className="admin-wb-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Records</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="prospective">Prospective</option>
          </select>
          <select className="admin-wb-select" value={oilCoFilterId} onChange={(e) => setOilCoFilterId(e.target.value)}>
            <option value="">All Oil Companies</option>
            {oilCompanies.map((oc) => (
              <option key={oc._id} value={oc._id}>{oc.name}</option>
            ))}
          </select>
          <select
            className="admin-wb-select"
            value={flagFilter}
            onChange={(e) => setFlagFilter(e.target.value)}
            title="Filter by member flag"
          >
            <option value="">All Members</option>
            <option value="standardMembership">Standard</option>
            <option value="seniorMember">Senior</option>
            <option value="waiveFeeLifetime">Lifetime</option>
            <option value="waiveFeeSenior">Waive Fee — Senior</option>
            <option value="waived">Registration Waived</option>
            <option value="lowVolume">Low Volume</option>
            <option value="useBothNames">Use Both Names</option>
            <option value="mailAddr">Has Mail Address</option>
          </select>
          <input
            className="admin-wb-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void loadMembers(); }}
            placeholder="Search records..."
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

      <div className="admin-wb-body">
        {activeTab === "Data Entry" && current && (
          <div className="admin-wb-grid">
            <div className="admin-wb-col">
            <div className="admin-wb-panel">
              <div className="admin-wb-panel-title">Member Identity</div>
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
                    display: "grid",
                    gridTemplateColumns: "120px 130px 130px minmax(0, 1fr)",
                    gap: "0.22rem 0.55rem",
                    alignItems: "end",
                  }}
                >
                  <label>
                    ID
                    <input className="admin-input" readOnly value={current.memberNumber || legacyValue("legacyId") || "—"} />
                  </label>
                  <label>
                    New Member Dt
                    <input className="admin-input" type="date" value={legacyValue("newMemberDt")} onChange={(e) => setLegacy("newMemberDt", e.target.value)} />
                  </label>
                  <label>
                    Original Start Date
                    <input className="admin-input" type="date" value={legacyValue("originalStartDate")} onChange={(e) => setLegacy("originalStartDate", e.target.value)} />
                  </label>
                  <div
                    className="admin-checkbox-grid"
                    style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.2rem 0.55rem", alignContent: "end", paddingBottom: "0.2rem" }}
                  >
                    <label>
                      <input type="checkbox" checked={legacyBool("standardMembership")} onChange={(e) => setLegacy("standardMembership", e.target.checked)} />
                      Standard
                    </label>
                    <label>
                      <input type="checkbox" checked={legacyBool("seniorMember")} onChange={(e) => setLegacy("seniorMember", e.target.checked)} />
                      Senior
                    </label>
                    <label>
                      <input type="checkbox" checked={legacyBool("lowVolume")} onChange={(e) => setLegacy("lowVolume", e.target.checked)} />
                      Low Volume
                    </label>
                    <label>
                      <input type="checkbox" checked={legacyBool("waiveFeeLifetime")} onChange={(e) => setLegacy("waiveFeeLifetime", e.target.checked)} />
                      Lifetime
                    </label>
                    <label>
                      <input type="checkbox" checked={legacyBool("mailAddr")} onChange={(e) => setLegacy("mailAddr", e.target.checked)} />
                      Mail Addr
                    </label>
                    <button
                      type="button"
                      className="admin-wb-btn admin-wb-btn-primary"
                      style={{ fontSize: "0.62rem", padding: "0.18rem 0.5rem", fontWeight: 700 }}
                      onClick={() => setActiveTab("MAILINGS")}
                      disabled={!legacyBool("mailAddr")}
                      title={legacyBool("mailAddr") ? "Open Mail Manager" : "Check Mail Addr first to enable"}
                    >
                      Mail Manager
                    </button>
                  </div>
                </div>
                <div
                  className="admin-form-span-4"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 110px 1fr 64px auto",
                    gap: "0.22rem 0.32rem",
                    alignItems: "end",
                  }}
                >
                  <label>First Name 1<input className="admin-input" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} /></label>
                  <label>Mid Name 1<input className="admin-input" value={legacyValue("midName1")} onChange={(e) => setLegacy("midName1", e.target.value)} /></label>
                  <label>Last Name 1<input className="admin-input" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} /></label>
                  <label>Suffix 1<input className="admin-input" value={legacyValue("suffix1")} onChange={(e) => setLegacy("suffix1", e.target.value)} /></label>
                  <label
                    style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem", fontWeight: 600, paddingBottom: "0.32rem", whiteSpace: "nowrap" }}
                    title="Address letters and emails to both names"
                  >
                    <input type="checkbox" checked={legacyBool("useBothNames")} onChange={(e) => setLegacy("useBothNames", e.target.checked)} />
                    Use Both Names
                  </label>
                  <label>First Name 2<input className="admin-input" value={legacyValue("firstName2")} onChange={(e) => setLegacy("firstName2", e.target.value)} /></label>
                  <label>Mid Name 2<input className="admin-input" value={legacyValue("midName2")} onChange={(e) => setLegacy("midName2", e.target.value)} /></label>
                  <label>Last Name 2<input className="admin-input" value={legacyValue("lastName2")} onChange={(e) => setLegacy("lastName2", e.target.value)} /></label>
                  <label>Suffix 2<input className="admin-input" value={legacyValue("suffix2")} onChange={(e) => setLegacy("suffix2", e.target.value)} /></label>
                  <span />
                </div>
                <div
                  className="admin-form-span-4"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1.2fr) 56px minmax(0, 1fr) minmax(0, 1fr) 44px 76px",
                    gap: "0.22rem 0.32rem",
                  }}
                >
                  <label>Street Nm<input className="admin-input" value={form.addressLine1} onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))} /></label>
                  <label>Apt No<input className="admin-input" value={legacyValue("aptNo1")} onChange={(e) => setLegacy("aptNo1", e.target.value)} /></label>
                  <label>Address Line 2<input className="admin-input" value={form.addressLine2} onChange={(e) => setForm((f) => ({ ...f, addressLine2: e.target.value }))} /></label>
                  <label>City<input className="admin-input" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} /></label>
                  <label>State<input className="admin-input" maxLength={2} value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase().slice(0, 2) }))} /></label>
                  <label>Zip<input className="admin-input" maxLength={10} value={form.postalCode} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))} /></label>
                </div>
                <div
                  className="admin-form-span-4"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) 92px 72px minmax(0, 1fr)",
                    gap: "0.22rem 0.32rem",
                  }}
                >
                  <label>
                    Phone 1
                    <input
                      className="admin-input"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      onBlur={(e) => setForm((f) => ({ ...f, phone: formatPhoneValue(e.target.value) }))}
                    />
                  </label>
                  <label>
                    Type Phone 1
                    <select className="admin-input" value={legacyValue("typePhone1") || "HOME"} onChange={(e) => setLegacy("typePhone1", e.target.value)}>
                      {PHONE_TYPE.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    P1 Ext
                    <input
                      className="admin-input"
                      inputMode="numeric"
                      maxLength={3}
                      value={legacyValue("p1Ext")}
                      onChange={(e) => setLegacy("p1Ext", e.target.value.replace(/\D/g, "").slice(0, 3))}
                    />
                  </label>
                  <label>E Mail<input className="admin-input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></label>
                </div>
                <div
                  className="admin-form-span-4"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) 92px 72px minmax(0, 1fr)",
                    gap: "0.22rem 0.32rem",
                  }}
                >
                  <label>
                    Phone 2
                    <input
                      className="admin-input"
                      value={legacyValue("phone2")}
                      onChange={(e) => setLegacy("phone2", e.target.value)}
                      onBlur={(e) => setLegacy("phone2", formatPhoneValue(e.target.value))}
                    />
                  </label>
                  <label>
                    Type Phone 2
                    <select className="admin-input" value={legacyValue("typePhone2") || "HOME"} onChange={(e) => setLegacy("typePhone2", e.target.value)}>
                      {PHONE_TYPE.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    P2 Ext
                    <input
                      className="admin-input"
                      inputMode="numeric"
                      maxLength={3}
                      value={legacyValue("p2Ext")}
                      onChange={(e) => setLegacy("p2Ext", e.target.value.replace(/\D/g, "").slice(0, 3))}
                    />
                  </label>
                  <label>E Mail 2<input className="admin-input" value={legacyValue("email2")} onChange={(e) => setLegacy("email2", e.target.value)} /></label>
                </div>
                <div
                  className="admin-form-span-4"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) 92px 72px minmax(0, 1fr)",
                    gap: "0.22rem 0.32rem",
                  }}
                >
                  <label>
                    Phone 3
                    <input
                      className="admin-input"
                      value={legacyValue("phone3")}
                      onChange={(e) => setLegacy("phone3", e.target.value)}
                      onBlur={(e) => setLegacy("phone3", formatPhoneValue(e.target.value))}
                    />
                  </label>
                  <label>
                    Type Phone 3
                    <select className="admin-input" value={legacyValue("typePhone3") || "HOME"} onChange={(e) => setLegacy("typePhone3", e.target.value)}>
                      {PHONE_TYPE.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    P3 Ext
                    <input
                      className="admin-input"
                      inputMode="numeric"
                      maxLength={3}
                      value={legacyValue("p3Ext")}
                      onChange={(e) => setLegacy("p3Ext", e.target.value.replace(/\D/g, "").slice(0, 3))}
                    />
                  </label>
                  <span />
                </div>
                <label>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "0.3rem" }}>
                    <input type="checkbox" checked={legacyBool("emailOptOut")} onChange={(e) => setLegacy("emailOptOut", e.target.checked)} />
                    <span style={{ fontSize: "0.62rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#dc2626" }}>Opted out</span>
                  </span>
                </label>
                <label>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "0.3rem" }}>
                    <input type="checkbox" checked={legacyBool("callBack")} onChange={(e) => setLegacy("callBack", e.target.checked)} />
                    Call Back
                  </span>
                  <input
                    className="admin-input"
                    type="date"
                    value={legacyValue("callBackDate")}
                    onChange={(e) => setLegacy("callBackDate", e.target.value)}
                    style={{ marginTop: "0.3rem" }}
                  />
                </label>
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
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.4fr)",
                    gap: "0.22rem 0.32rem",
                  }}
                >
                  <label>Employer<input className="admin-input" value={legacyValue("employer")} onChange={(e) => setLegacy("employer", e.target.value)} /></label>
                  <label>Company<input className="admin-input" value={legacyValue("company")} onChange={(e) => setLegacy("company", e.target.value)} /></label>
                  <label>The Next Step?<input className="admin-input" value={legacyValue("nextStep")} onChange={(e) => setLegacy("nextStep", e.target.value)} /></label>
                </div>
                <label>Referred By ID<input className="admin-input" value={legacyValue("referredById")} onChange={(e) => setLegacy("referredById", e.target.value)} /></label>
                <label>Date Referred<input className="admin-input" type="date" value={legacyValue("dateReferred")} onChange={(e) => setLegacy("dateReferred", e.target.value)} /></label>
              </div>
            </div>

            </div> {/* end left col */}
            <div className="admin-wb-col">
            <div className="admin-wb-panel">
              <div className="admin-wb-panel-title">Oil Company Status</div>
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
              <div className="admin-form-grid-4">
                <label>
                  Oil Co Code
                  <select className="admin-input" value={form.oilCompanyId} onChange={(e) => setForm((f) => ({ ...f, oilCompanyId: e.target.value }))}>
                    <option value="">—</option>
                    {oilCompanies.map((oc) => (
                      <option key={oc._id} value={oc._id}>{oc.name}</option>
                    ))}
                  </select>
                </label>
                <label>Oil ID<input className="admin-input" value={legacyValue("oilId")} onChange={(e) => setLegacy("oilId", e.target.value)} /></label>
                <label>
                  Oil Co Info
                  <button
                    type="button"
                    className="admin-btn"
                    style={{fontSize: "0.6rem", padding: "0.2rem 0.5rem"}}
                    onClick={() => {
                      const oc = oilCompanies.find((x) => x._id === form.oilCompanyId);
                      openPrintPreview(
                        "Oil Company Info",
                        `<h1>Oil Company Info</h1><pre>${JSON.stringify(oc || { message: "No company selected." }, null, 2)}</pre>`
                      );
                    }}
                  >
                    OIL CO INFO
                  </button>
                </label>
                <label>Oil Start Date<input className="admin-input" type="date" value={legacyValue("oilStartDate")} onChange={(e) => setLegacy("oilStartDate", e.target.value)} /></label>
                <label className="admin-form-span-2">
                  How Joined
                  <select className="admin-input" value={legacyValue("howJoined") || "WEB"} onChange={(e) => setLegacy("howJoined", e.target.value)}>
                    {HOW_JOINED.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="admin-form-span-2">
                  Referral
                  <select className="admin-input" value={legacyValue("referralSource") || "OTHER"} onChange={(e) => setLegacy("referralSource", e.target.value)}>
                    {REFERRAL_SOURCE.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="admin-wb-panel">
              <div className="admin-wb-panel-title">Propane Company Info</div>
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
              <div className="admin-form-grid-4">
                <label>
                  Prop Co Code
                  <select className="admin-input" value={legacyValue("propCoCode")} onChange={(e) => setLegacy("propCoCode", e.target.value)}>
                    <option value="">—</option>
                    <option value="THOM">THOM</option>
                  </select>
                </label>
                <label>Propane ID<input className="admin-input" value={legacyValue("propaneId")} onChange={(e) => setLegacy("propaneId", e.target.value)} /></label>
                <label>
                  Prop Co Info
                  <button
                    type="button"
                    className="admin-btn"
                    style={{fontSize: "0.6rem", padding: "0.2rem 0.5rem", background: "#ea580c", color: "#fff", borderColor: "#c2410c"}}
                    onClick={() =>
                      openPrintPreview(
                        "Propane Company Info",
                        `<h1>Propane Company Info</h1><p>Propane details are currently maintained in legacy profile fields.</p><pre>${JSON.stringify({
                          propCoCode: legacyValue("propCoCode"),
                          propaneId: legacyValue("propaneId"),
                          propaneStatus: legacyValue("propaneStatus"),
                          propaneStartDate: legacyValue("propaneStartDate"),
                        }, null, 2)}</pre>`
                      )
                    }
                  >
                    PROP CO INFO
                  </button>
                </label>
                <label>Propane Start Date<input className="admin-input" type="date" value={legacyValue("propaneStartDate")} onChange={(e) => setLegacy("propaneStartDate", e.target.value)} /></label>
              </div>
            </div>

            <div className="admin-wb-panel">
              <div className="admin-wb-panel-title">Delivery Status</div>
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
                onClick={() =>
                  openPrintPreview(
                    "Delivery History",
                    `<h1>Delivery History</h1><p>No dedicated delivery ledger exists yet. Current flags:</p><pre>${JSON.stringify({
                      deliveryHistory: legacyBool("deliveryHistory"),
                      nrdOil: legacyBool("nrdOil"),
                      nrdProp: legacyBool("nrdProp"),
                    }, null, 2)}</pre>`
                  )
                }
              >
                DELIVERY HISTORY
              </button>
            </div>

            <div className="admin-wb-panel">
              <div className="admin-wb-panel-title">Solar, Insurance &amp; Energy Audits</div>
              <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--wb-muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "0.2rem" }}>Solar</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "0.22rem 0.45rem",
                  marginBottom: "0.5rem",
                }}
              >
                <label>Referral Sent Date<input className="admin-input" type="date" value={legacyValue("solorReferralSentDate")} onChange={(e) => setLegacy("solorReferralSentDate", e.target.value)} /></label>
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
              <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--wb-muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "0.2rem" }}>Energy Audit</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "0.22rem 0.45rem",
                  marginBottom: "0.5rem",
                }}
              >
                <label>Referral Date<input className="admin-input" type="date" value={legacyValue("energyAuditReferralDate")} onChange={(e) => setLegacy("energyAuditReferralDate", e.target.value)} /></label>
                <label>Date Paid<input className="admin-input" type="date" value={legacyValue("energyAuditDatePaid")} onChange={(e) => setLegacy("energyAuditDatePaid", e.target.value)} /></label>
                <label style={{ gridColumn: "span 2" }}>Notes<input className="admin-input" value={legacyValue("energyAuditNotes")} onChange={(e) => setLegacy("energyAuditNotes", e.target.value)} /></label>
              </div>
              <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--wb-muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "0.2rem" }}>Insurance Audit</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "0.22rem 0.45rem",
                }}
              >
                <label>Referral Date<input className="admin-input" type="date" value={legacyValue("insuranceAuditReferralDate")} onChange={(e) => setLegacy("insuranceAuditReferralDate", e.target.value)} /></label>
                <label>Date Paid<input className="admin-input" type="date" value={legacyValue("insuranceDatePaid")} onChange={(e) => setLegacy("insuranceDatePaid", e.target.value)} /></label>
                <label style={{ gridColumn: "span 2" }}>Notes<input className="admin-input" value={legacyValue("insuranceAuditNotes")} onChange={(e) => setLegacy("insuranceAuditNotes", e.target.value)} /></label>
              </div>
            </div>

            <div className="admin-wb-panel electric">
              <div className="admin-wb-panel-title">Electric Status</div>
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
              <div className="admin-form-grid-3">
                <label>Elec Sign Up Date<input className="admin-input" value={legacyValue("elecSignUpDate")} onChange={(e) => setLegacy("elecSignUpDate", e.target.value)} /></label>
                <label>Elec Start Date<input className="admin-input" value={legacyValue("elecStartDate")} onChange={(e) => setLegacy("elecStartDate", e.target.value)} /></label>
                <label>Name Key<input className="admin-input" value={legacyValue("nameKey")} onChange={(e) => setLegacy("nameKey", e.target.value)} /></label>
                <label>Dropped Date<input className="admin-input" value={legacyValue("droppedDate")} onChange={(e) => setLegacy("droppedDate", e.target.value)} /></label>
                <label className="admin-form-span-2">Electricity Account Number<input className="admin-input" value={legacyValue("electricAccountNumber")} onChange={(e) => setLegacy("electricAccountNumber", e.target.value)} /></label>
                <div className="admin-checkbox-grid">
                  <label>
                    <input type="checkbox" checked={legacyBool("notPaidCurrentYr")} onChange={(e) => setLegacy("notPaidCurrentYr", e.target.checked)} />
                    Not Paid Current Yr
                  </label>
                  <label>
                    <input type="checkbox" checked={legacyBool("delinquent")} onChange={(e) => setLegacy("delinquent", e.target.checked)} />
                    Delinquent
                  </label>
                </div>
              </div>
            </div>

            </div> {/* end right col */}
            <div
              style={{
                gridColumn: "1 / -1",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.55rem",
              }}
            >
              <div className="admin-wb-panel">
                <div className="admin-wb-panel-title">Legacy Note</div>
                {form.notes ? (
                  <div style={{ fontSize: "0.8rem", whiteSpace: "pre-wrap", color: "var(--wb-text)" }}>{form.notes}</div>
                ) : (
                  <p style={{ color: "var(--wb-muted)", fontSize: "0.75rem", margin: 0 }}>No legacy note on file.</p>
                )}
              </div>
              <div className="admin-wb-panel">
                <div className="admin-wb-panel-title">Legacy Profile</div>
                <div className="admin-form-grid-4" style={{ fontSize: "0.75rem" }}>
                  <label>Legacy ID<input className="admin-input" readOnly value={legacyValue("legacyId") || "—"} /></label>
                  <label>Record Type<input className="admin-input" readOnly value={legacyValue("recordType") || "—"} /></label>
                  <label>Import Source<input className="admin-input" readOnly value={legacyValue("importSource") || "—"} /></label>
                  <label>Date Added<input className="admin-input" readOnly value={legacyValue("dateAdd") || "—"} /></label>
                  <label>Date Updated<input className="admin-input" readOnly value={legacyValue("dateUpdat") || "—"} /></label>
                  <label>Last User<input className="admin-input" readOnly value={legacyValue("lastUser") || "—"} /></label>
                  <label>Key Codes<input className="admin-input" readOnly value={legacyValue("keyCodes") || "—"} /></label>
                  <label>Carrier Rt<input className="admin-input" readOnly value={legacyValue("carrierRt") || "—"} /></label>
                  <label>Oil Co Raw<input className="admin-input" readOnly value={legacyValue("oilCoRaw") || "—"} /></label>
                  <label>Plus 4<input className="admin-input" readOnly value={legacyValue("plus4") || "—"} /></label>
                  <label>Formal 1<input className="admin-input" readOnly value={legacyValue("formal1") || "—"} /></label>
                  <label>Formal 2<input className="admin-input" readOnly value={legacyValue("formal2") || "—"} /></label>
                  <label>Pref 1<input className="admin-input" readOnly value={legacyValue("pref1") || "—"} /></label>
                  <label>Pref 2<input className="admin-input" readOnly value={legacyValue("pref2") || "—"} /></label>
                  <label>Generation 1<input className="admin-input" readOnly value={legacyValue("generation1") || "—"} /></label>
                  <label>Generation 2<input className="admin-input" readOnly value={legacyValue("generation2") || "—"} /></label>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "PAYMENT HISTORY" && current && (
          <div className="admin-workbench-data-entry admin-payment-compact">
            <div className="admin-card admin-workbench-section">
              <h2>Payment History</h2>
              <div className="admin-form-grid-4">
                <label>ID<input className="admin-input" readOnly value={current.memberNumber || legacyValue("legacyId") || "—"} /></label>
                <label>New Member Dt<input className="admin-input" readOnly value={current.createdAt ? new Date(current.createdAt).toLocaleDateString() : "—"} /></label>
                <label>F Name 1<input className="admin-input" readOnly value={current.firstName} /></label>
                <label>L Name 1<input className="admin-input" readOnly value={current.lastName} /></label>
                <label className="admin-form-span-2">
                  Full Address
                  <input
                    className="admin-input"
                    readOnly
                    value={[current.addressLine1, current.addressLine2].filter(Boolean).join(", ") || "—"}
                  />
                </label>
                <label>
                  City / State / Zip
                  <input
                    className="admin-input"
                    readOnly
                    value={[current.city, current.state, current.postalCode].filter(Boolean).join(" ").trim() || "—"}
                  />
                </label>
                <label>
                  Phone 1 ({legacyValue("typePhone1") || "HOME"})
                  <input className="admin-input" readOnly value={formatPhoneValue(current.phone || "—")} />
                </label>
                <label>
                  Phone 2 ({legacyValue("typePhone2") || "HOME"})
                  <input className="admin-input" readOnly value={formatPhoneValue(legacyValue("phone2") || "—")} />
                </label>
                <label>
                  E Mail
                  <input className="admin-input" readOnly value={`${current.email}${legacyBool("emailOptOut") ? " — Opted Out" : ""}`} />
                </label>
                <label>Oil Co<input className="admin-input" readOnly value={current.oilCompanyId?.name || "—"} /></label>
                <label>Oil ID<input className="admin-input" readOnly value={legacyValue("oilId") || "—"} /></label>
                <label>Propane ID<input className="admin-input" readOnly value={legacyValue("propaneId") || "—"} /></label>
              </div>
              <div className="admin-status-pill-row">
                <span className="admin-pill">O I L — {legacyValue("oilWorkbenchStatus") || legacyValue("workbenchMemberStatus") || "—"}</span>
                <span className="admin-pill">P R O P — {legacyValue("propaneStatus") || "—"}</span>
                {isLifetime && <span className="admin-pill ok">Lifetime Member</span>}
                {isWaived && <span className="admin-pill">Waived</span>}
                {isSenior && <span className="admin-pill">Senior</span>}
                {isLowVolume && <span className="admin-pill">Low Volume</span>}
              </div>
            </div>

            <div className="admin-card admin-workbench-section">
              <h3>Registration Fee</h3>
              <div className="admin-form-grid-4">
                <label>Cluster<input className="admin-input" value={legacyValue("regCluster")} onChange={(e) => setLegacy("regCluster", e.target.value)} /></label>
                <label>Registration Fee<input className="admin-input" value={legacyValue("registrationFee")} onChange={(e) => setLegacy("registrationFee", e.target.value)} /></label>
                <label>Dt Paid<input className="admin-input" value={legacyValue("regDtPaid")} onChange={(e) => setLegacy("regDtPaid", e.target.value)} /></label>
                <label>Check / Credit<input className="admin-input" value={legacyValue("regCheckCredit")} onChange={(e) => setLegacy("regCheckCredit", e.target.value)} /></label>
                <div className="admin-checkbox-grid">
                  <label>
                    <input type="checkbox" checked={legacyBool("waiveFeeSenior")} onChange={(e) => setLegacy("waiveFeeSenior", e.target.checked)} />
                    Waive fee — Senior
                  </label>
                  <label>
                    <input type="checkbox" checked={legacyBool("waiveFeeLifetime")} onChange={(e) => setLegacy("waiveFeeLifetime", e.target.checked)} />
                    Lifetime Member
                  </label>
                </div>
                <label className="admin-form-span-2">
                  Registration status
                  <select className="admin-input" value={legacyValue("registrationPaymentStatus") || ""} onChange={(e) => setLegacy("registrationPaymentStatus", e.target.value)}>
                    <option value="">—</option>
                    <option value="paid">Registration PAID</option>
                    <option value="waived">Registration WAIVED</option>
                    <option value="not_paid">Not Paid Current Yr</option>
                  </select>
                </label>
                <label className="admin-form-span-2 admin-note-field">
                  Payment notes
                  <textarea className="admin-input admin-note-input" value={legacyValue("paymentNotes")} onChange={(e) => setLegacy("paymentNotes", e.target.value)} />
                </label>
              </div>
            </div>

            <div className="admin-card admin-workbench-section">
              <h3>Credit Card Information</h3>
              <div className="admin-form-grid-4">
                <label>
                  Card Type
                  <select className="admin-input" value={legacyValue("ccType") || ""} onChange={(e) => setLegacy("ccType", e.target.value)}>
                    <option value="">—</option>
                    <option value="visa">VISA</option>
                    <option value="mastercard">MasterCard</option>
                    <option value="amex">AMEX</option>
                  </select>
                </label>
                <label># Last 4 (only)<input className="admin-input" value={legacyValue("ccLast4")} onChange={(e) => setLegacy("ccLast4", e.target.value)} placeholder="Never store full PAN" /></label>
                <label>Expiration<input className="admin-input" value={legacyValue("ccExp")} onChange={(e) => setLegacy("ccExp", e.target.value)} /></label>
                <label>Name on Card<input className="admin-input" value={legacyValue("ccName")} onChange={(e) => setLegacy("ccName", e.target.value)} /></label>
              </div>
            </div>

            <div className="admin-card admin-workbench-section">
              <h3>Renewal Fee — Billing</h3>
              <p className="admin-readonly-hint">Live billing events from the database. Edit payment worksheet fields above as needed for legacy notes.</p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Billing Year</th>
                      <th>Fee Waived</th>
                      <th>Date Received</th>
                      <th>Amount Received</th>
                      <th>Payment Method</th>
                      <th>New / Renew</th>
                      <th>Ref / Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billing.length === 0 ? (
                      <tr><td colSpan={7}>No billing rows yet.</td></tr>
                    ) : (
                      billing.map((b) => (
                        <tr key={b._id}>
                          <td>{b.billingYear ?? "—"}</td>
                          <td>{b.status === "waived" ? "Yes" : "No"}</td>
                          <td>{new Date(b.createdAt).toLocaleDateString()}</td>
                          <td>${(b.amountCents / 100).toFixed(2)}</td>
                          <td>{b.kind === "registration" ? "Registration" : b.kind === "annual" ? "Annual" : b.kind}</td>
                          <td>{b.kind === "registration" ? "New" : "Renew"}</td>
                          <td>{b.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "PAYMENT HISTORY" && !current && (
          <p className="admin-meta">Select a member with Search, or add a new record.</p>
        )}

        {activeTab === "MAILINGS" && (
          <div className="admin-workbench-data-entry">
            <div className="admin-card admin-workbench-section">
              <h2>Mail Manager</h2>
              <h3>Templates</h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: "0.35rem",
                  marginBottom: "0.55rem",
                }}
              >
                {(Object.keys(MAILING_TEMPLATES) as Array<keyof typeof MAILING_TEMPLATES>).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`admin-wb-btn ${mailTemplateKey === key ? "admin-wb-btn-primary" : "admin-wb-btn-secondary"}`}
                    style={{ width: "100%", justifyContent: "center", minHeight: "1.85rem", fontSize: "0.68rem", padding: "0.22rem 0.38rem" }}
                    onClick={() => setMailTemplateKey(key)}
                  >
                    {MAILING_TEMPLATES[key].label}
                  </button>
                ))}
              </div>
              <div className="admin-form-grid">
                <label>
                  Recipient (selected member)
                  <input className="admin-input" readOnly value={mailingMergeData.memberName} />
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
                  Letter Header
                  <textarea
                    className="admin-input admin-note-input"
                    style={{ minHeight: "74px" }}
                    value={mailHeader}
                    onChange={(e) => setMailHeader(e.target.value)}
                    placeholder={"Oil Co-op Administrative Office\nMember Services Workbench"}
                  />
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
                  Body
                  <textarea className="admin-input admin-note-input" style={{ minHeight: "180px" }} value={mailBody} onChange={(e) => setMailBody(e.target.value)} />
                </label>
                <label className="admin-form-span-2">
                  Letter Footer
                  <textarea
                    className="admin-input admin-note-input"
                    style={{ minHeight: "88px" }}
                    value={mailFooter}
                    onChange={(e) => setMailFooter(e.target.value)}
                    placeholder={"Sincerely,\nOil Co-op Member Services"}
                  />
                </label>
              </div>
              <div className="admin-actions-row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="admin-btn admin-btn-ghost"
                  style={{ minWidth: "150px" }}
                  onClick={() => {
                    setMailHeader(DEFAULT_MAIL_HEADER);
                    setMailFooter(DEFAULT_MAIL_FOOTER);
                  }}
                >
                  Reset Header/Footer
                </button>
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
                  onClick={() => openPrintPreview("Mailing Letter Preview", mailingPreviewHtml)}
                >
                  Preview Letter
                </button>
                <button
                  type="button"
                  className="admin-btn"
                  style={{ minWidth: "130px" }}
                  onClick={() => openPrintPreview("Mailing Letter", mailingPreviewHtml, true)}
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
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Referrer</th><th>Email</th></tr></thead>
              <tbody>
                <tr>
                  <td>{referral?.referrerMemberId ? `${referral.referrerMemberId.firstName || ""} ${referral.referrerMemberId.lastName || ""}` : "None"}</td>
                  <td>{referral?.referrerMemberId?.email || "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "MEMBERS LIST" && (
          <div className="admin-workbench-data-entry">
            <div className="admin-card admin-workbench-section">
              <h2>Members List</h2>
              <div className="admin-toolbar" style={{ marginBottom: "0.75rem" }}>
                <span className="admin-meta">All Members</span>
                <select className="admin-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">Filter by Status — All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="prospective">Prospective</option>
                </select>
                <input className="admin-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" style={{ minWidth: "12rem" }} />
                <button type="button" className="admin-btn" onClick={() => void loadMembers()} disabled={loading}>{loading ? "Loading..." : "Search"}</button>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr><th>ID</th><th>Name</th><th>Address</th><th>City</th><th>Phone</th><th>Oil Co</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {members.map((m, i) => (
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
                <button type="button" className="admin-btn" onClick={() => generateWorksheetCsv(worksheetMembers)}>
                  Export Worksheet to Excel
                </button>
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
                      <th><button type="button" className="admin-btn admin-btn-ghost" onClick={() => toggleWorksheetSort("memberNumber")}>ID</button></th>
                      <th><button type="button" className="admin-btn admin-btn-ghost" onClick={() => toggleWorksheetSort("name")}>Name</button></th>
                      <th><button type="button" className="admin-btn admin-btn-ghost" onClick={() => toggleWorksheetSort("address")}>Address</button></th>
                      <th><button type="button" className="admin-btn admin-btn-ghost" onClick={() => toggleWorksheetSort("city")}>City</button></th>
                      <th><button type="button" className="admin-btn admin-btn-ghost" onClick={() => toggleWorksheetSort("phone")}>Phone</button></th>
                      <th><button type="button" className="admin-btn admin-btn-ghost" onClick={() => toggleWorksheetSort("oilCompany")}>Oil Co</button></th>
                      <th><button type="button" className="admin-btn admin-btn-ghost" onClick={() => toggleWorksheetSort("notes")}>Notes</button></th>
                      <th><button type="button" className="admin-btn admin-btn-ghost" onClick={() => toggleWorksheetSort("status")}>Status</button></th>
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
                          <td style={{ fontWeight: 600 }}>{m.memberNumber || "—"}</td>
                          <td style={{ fontWeight: 600 }}>{m.firstName} {m.lastName}</td>
                          <td style={{ fontWeight: 600 }}>{[m.addressLine1, m.addressLine2].filter(Boolean).join(", ") || "—"}</td>
                          <td style={{ fontWeight: 600 }}>{m.city || "—"}</td>
                          <td style={{ fontWeight: 600 }}>{m.phone || "—"}</td>
                          <td style={{ fontWeight: 600 }}>{m.oilCompanyId?.name || "—"}</td>
                          <td style={{ fontWeight: 600 }}>{m.notes || "—"}</td>
                          <td><span className={`admin-pill${m.status === "active" ? " ok" : ""}`}>{m.status}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {worksheetPageRows.length === 0 && (
                <p className="admin-meta" style={{ marginTop: "0.75rem" }}>No members match the current search/filter.</p>
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
                    openPrintPreview("Refund Letter Preview", refundLetterHtml());
                  }}
                >
                  Preview
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
                    openPrintPreview("Start Date Letter Preview", startDateLetterHtml());
                  }}
                >
                  Preview
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
                      .map(
                        (m) =>
                          brandedLetterHtml(
                            "Referral Thank-You Letter",
                            `${m.firstName} ${m.lastName}`,
                            `Thank you for your referrals to Oil Co-op.\n\nMember #: ${m.memberNumber || "—"}`
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
    </div>
  );
}
