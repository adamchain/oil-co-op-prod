import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../authContext";

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
  "Oil Co Worksheet",
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
  createdAt?: string;
  oilCompanyId?: { _id: string; name: string } | null;
  legacyProfile?: Record<string, unknown>;
};

type OilCompany = { _id: string; name: string; contactEmail?: string; contactPhone?: string };
type BillingEvent = { _id: string; kind: string; status: string; amountCents: number; billingYear?: number; createdAt: string };
type Comm = { _id: string; channel: string; subject?: string; status: string; createdAt: string };
type Referral = { referrerMemberId?: { firstName?: string; lastName?: string; email?: string } };

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

const WB_MEMBER_STATUS = ["ACTIVE", "INACTIVE", "PROSPECTIVE", "RESIDENT", "NO OIL", "UNKNOWN", "CANCELLED"] as const;
const WB_OIL_STATUS = ["ACTIVE", "INACTIVE", "PROSPECTIVE", "RESIDENT", "NO OIL", "UNKNOWN"] as const;
const WB_PROPANE_STATUS = ["ACTIVE", "INACTIVE", "PROSPECTIVE", "RESIDENT", "NO PROPANE", "UNKNOWN"] as const;
const ELECTRIC_STATUS = ["ELECTRIC", "PENDING", "INTERESTED", "UNKNOWN", "DROPPED"] as const;
const REC_TYPE = ["IND", "BUS"] as const;
const PHONE_TYPE = ["HOME", "WORK", "CELL"] as const;
const HOW_JOINED = ["PHO", "WEB", "REF", "MAIL"] as const;
const REFERRAL_SOURCE = ["CCAG", "MEMBER", "OTHER"] as const;

export default function AdminWorkbenchPage() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<TabName>("Data Entry");
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [oilCompanies, setOilCompanies] = useState<OilCompany[]>([]);
  const [billing, setBilling] = useState<BillingEvent[]>([]);
  const [communications, setCommunications] = useState<Comm[]>([]);
  const [referral, setReferral] = useState<Referral | null>(null);
  const [oilCoWorksheetId, setOilCoWorksheetId] = useState("");

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
    void loadMembers();
    void loadOilCompanies();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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

  const membersForOilWorksheet = useMemo(() => {
    if (!oilCoWorksheetId) return members;
    return members.filter((m) => m.oilCompanyId?._id === oilCoWorksheetId);
  }, [members, oilCoWorksheetId]);

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
    await api(`/api/admin/members/${current._id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ ...form, status }),
    });
    await loadMembers();
  };

  const setLegacy = (key: string, value: string | boolean) =>
    setForm((f) => ({ ...f, legacyProfile: { ...f.legacyProfile, [key]: value } }));

  const legacyValue = (key: string) => String(form.legacyProfile[key] ?? "");

  const legacyBool = (key: string) => Boolean(form.legacyProfile[key]);

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
          <input
            className="admin-wb-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void loadMembers(); }}
            placeholder="Search members..."
          />
          <select className="admin-wb-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Records</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="prospective">Prospective</option>
          </select>
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

      <div className="admin-wb-body">
        {activeTab === "Data Entry" && current && (
          <div className="admin-wb-grid">
            <div className="admin-wb-col">
            <div className="admin-wb-panel">
              <div className="admin-wb-panel-title">Member Identity</div>
              <div className="admin-wb-status-row">
                {WB_MEMBER_STATUS.map((s) => (
                  <label key={s} className={`on-${s === "ACTIVE" ? "active" : s === "INACTIVE" ? "inactive" : s === "PROSPECTIVE" ? "prospect" : s === "NO OIL" ? "noOil" : "unknown"}`}>
                    <input
                      type="radio"
                      name="wb-member-status"
                      checked={(legacyValue("workbenchMemberStatus") || "ACTIVE") === s}
                      onChange={() => setLegacy("workbenchMemberStatus", s)}
                    />
                    {s}
                  </label>
                ))}
              </div>
              <div className="admin-form-grid-4">
                <label>
                  ID
                  <input className="admin-input" value={legacyValue("legacyId")} onChange={(e) => setLegacy("legacyId", e.target.value)} placeholder={current.memberNumber || ""} />
                </label>
                <label>
                  Rec Type
                  <select className="admin-input" value={legacyValue("recordType") || "IND"} onChange={(e) => setLegacy("recordType", e.target.value)}>
                    {REC_TYPE.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="admin-form-span-2">
                  New Member Dt
                  <input className="admin-input" value={legacyValue("newMemberDt")} onChange={(e) => setLegacy("newMemberDt", e.target.value)} placeholder={current.createdAt ? new Date(current.createdAt).toLocaleDateString() : ""} />
                </label>
                <label className="admin-form-span-2">
                  Original Start Date
                  <input className="admin-input" value={legacyValue("originalStartDate")} onChange={(e) => setLegacy("originalStartDate", e.target.value)} />
                </label>
                <div className="admin-checkbox-grid">
                  <label>
                    <input type="checkbox" checked={legacyBool("seniorMember")} onChange={(e) => setLegacy("seniorMember", e.target.checked)} />
                    Senior
                  </label>
                  <label>
                    <input type="checkbox" checked={legacyBool("useBothNames")} onChange={(e) => setLegacy("useBothNames", e.target.checked)} />
                    Use Both Names
                  </label>
                  <label>
                    <input type="checkbox" checked={legacyBool("mailAddr")} onChange={(e) => setLegacy("mailAddr", e.target.checked)} />
                    Mail Addr
                  </label>
                </div>
                <label>First Name 1<input className="admin-input" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} /></label>
                <label>Mid Name 1<input className="admin-input" value={legacyValue("midName1")} onChange={(e) => setLegacy("midName1", e.target.value)} /></label>
                <label>Last Name 1<input className="admin-input" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} /></label>
                <label>Suffix 1<input className="admin-input" value={legacyValue("suffix1")} onChange={(e) => setLegacy("suffix1", e.target.value)} /></label>
                <label>First Name 2<input className="admin-input" value={legacyValue("firstName2")} onChange={(e) => setLegacy("firstName2", e.target.value)} /></label>
                <label>Mid Name 2<input className="admin-input" value={legacyValue("midName2")} onChange={(e) => setLegacy("midName2", e.target.value)} /></label>
                <label>Last Name 2<input className="admin-input" value={legacyValue("lastName2")} onChange={(e) => setLegacy("lastName2", e.target.value)} /></label>
                <label>Suffix 2<input className="admin-input" value={legacyValue("suffix2")} onChange={(e) => setLegacy("suffix2", e.target.value)} /></label>
                <label>Street No<input className="admin-input" value={legacyValue("streetNo")} onChange={(e) => setLegacy("streetNo", e.target.value)} /></label>
                <label className="admin-form-span-2">Street Nm<input className="admin-input" value={form.addressLine1} onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))} /></label>
                <label>Apt No<input className="admin-input" value={legacyValue("aptNo1")} onChange={(e) => setLegacy("aptNo1", e.target.value)} /></label>
                <label className="admin-form-span-2">Address Line2<input className="admin-input" value={form.addressLine2} onChange={(e) => setForm((f) => ({ ...f, addressLine2: e.target.value }))} /></label>
                <label className="admin-form-span-2">&nbsp;</label>
                <label className="admin-form-span-2">City<input className="admin-input" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} /></label>
                <label>State<input className="admin-input" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} /></label>
                <label>Zip<input className="admin-input" value={form.postalCode} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))} /></label>
                <label className="admin-form-span-2">Company<input className="admin-input" value={legacyValue("company")} onChange={(e) => setLegacy("company", e.target.value)} /></label>
                <label className="admin-form-span-2">&nbsp;</label>
                <label className="admin-form-span-2 admin-note-field">
                  Note
                  <textarea className="admin-input admin-note-input" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                </label>
                <label className="admin-form-span-2">&nbsp;</label>
                <label>Employer<input className="admin-input" value={legacyValue("employer")} onChange={(e) => setLegacy("employer", e.target.value)} /></label>
                <label className="admin-form-span-3">&nbsp;</label>
                <label>The Next Step?<input className="admin-input" value={legacyValue("nextStep")} onChange={(e) => setLegacy("nextStep", e.target.value)} /></label>
                <label>Referred By ID<input className="admin-input" value={legacyValue("referredById")} onChange={(e) => setLegacy("referredById", e.target.value)} /></label>
                <label className="admin-form-span-2">Date Referred<input className="admin-input" value={legacyValue("dateReferred")} onChange={(e) => setLegacy("dateReferred", e.target.value)} /></label>
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
              <div className="admin-form-grid">
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
                <label className="admin-form-span-2">Oil ID<input className="admin-input" value={legacyValue("oilId")} onChange={(e) => setLegacy("oilId", e.target.value)} /></label>
                <label>Oil Co Info<button type="button" className="admin-btn" style={{fontSize: "0.6rem", padding: "0.2rem 0.5rem"}}>OIL CO INFO</button></label>
                <label>Oil Start Date<input className="admin-input" value={legacyValue("oilStartDate")} onChange={(e) => setLegacy("oilStartDate", e.target.value)} /></label>
                <label>
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
              <div className="admin-wb-panel-title">Contact Information</div>
              <div className="admin-form-grid-4">
                <label>Phone 1<input className="admin-input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></label>
                <label className="admin-form-span-2">
                  Type of Phone 1
                  <select className="admin-input" value={legacyValue("typePhone1") || "HOME"} onChange={(e) => setLegacy("typePhone1", e.target.value)}>
                    {PHONE_TYPE.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>P1 Ext<input className="admin-input" value={legacyValue("p1Ext")} onChange={(e) => setLegacy("p1Ext", e.target.value)} /></label>
                <label>Phone 2<input className="admin-input" value={legacyValue("phone2")} onChange={(e) => setLegacy("phone2", e.target.value)} /></label>
                <label className="admin-form-span-2">
                  Type of Phone 2
                  <select className="admin-input" value={legacyValue("typePhone2") || "HOME"} onChange={(e) => setLegacy("typePhone2", e.target.value)}>
                    {PHONE_TYPE.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>P2 Ext<input className="admin-input" value={legacyValue("p2Ext")} onChange={(e) => setLegacy("p2Ext", e.target.value)} /></label>
                <label>Phone 3<input className="admin-input" value={legacyValue("phone3")} onChange={(e) => setLegacy("phone3", e.target.value)} /></label>
                <label className="admin-form-span-2">
                  Type of Phone 3
                  <select className="admin-input" value={legacyValue("typePhone3") || "HOME"} onChange={(e) => setLegacy("typePhone3", e.target.value)}>
                    {PHONE_TYPE.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>P3 Ext<input className="admin-input" value={legacyValue("p3Ext")} onChange={(e) => setLegacy("p3Ext", e.target.value)} /></label>
                <label className="admin-form-span-2">
                  E Mail
                  <input className="admin-input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </label>
                <label className="admin-form-span-2">
                  <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "1rem" }}>
                    <span style={{ fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#dc2626" }}>
                      Opted Out
                    </span>
                  </span>
                </label>
                <label className="admin-form-span-2">E Mail 2<input className="admin-input" value={legacyValue("email2")} onChange={(e) => setLegacy("email2", e.target.value)} /></label>
                <label className="admin-form-span-2">&nbsp;</label>
                <label>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <input type="checkbox" checked={legacyBool("callBack")} onChange={(e) => setLegacy("callBack", e.target.checked)} />
                    Call Back
                  </span>
                </label>
                <label className="admin-form-span-2">Call Back Date<input className="admin-input" type="date" value={legacyValue("callBackDate")} onChange={(e) => setLegacy("callBackDate", e.target.value)} /></label>
                <label>&nbsp;</label>
                <label className="admin-form-span-2 admin-note-field">
                  Note
                  <textarea className="admin-input admin-note-input" value={legacyValue("contactNote")} onChange={(e) => setLegacy("contactNote", e.target.value)} />
                </label>
                <label className="admin-form-span-2">&nbsp;</label>
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
                <label className="admin-form-span-2">Propane ID<input className="admin-input" value={legacyValue("propaneId")} onChange={(e) => setLegacy("propaneId", e.target.value)} /></label>
                <label>Prop Co Info<button type="button" className="admin-btn" style={{fontSize: "0.6rem", padding: "0.2rem 0.5rem", background: "#ea580c", color: "#fff", borderColor: "#c2410c"}}>PROP CO INFO</button></label>
                <label className="admin-form-span-2">Propane Start Date<input className="admin-input" type="date" value={legacyValue("propaneStartDate")} onChange={(e) => setLegacy("propaneStartDate", e.target.value)} /></label>
                <label className="admin-form-span-2">&nbsp;</label>
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
              <button type="button" className="admin-btn" style={{fontSize: "0.6rem", padding: "0.2rem 0.5rem", background: "#dc2626", color: "#fff", borderColor: "#b91c1c"}}>DELIVERY HISTORY</button>
            </div>

            </div> {/* end right col */}
          </div>
        )}

        {activeTab === "PAYMENT HISTORY" && current && (
          <div className="admin-workbench-data-entry">
            <div className="admin-card admin-workbench-section">
              <h2>Payment History</h2>
              <div className="admin-form-grid">
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
                <label>Phone 1<input className="admin-input" readOnly value={current.phone || "—"} /></label>
                <label>Type of Phone 1<input className="admin-input" readOnly value={legacyValue("typePhone1") || "—"} /></label>
                <label>Phone 2<input className="admin-input" readOnly value={legacyValue("phone2") || "—"} /></label>
                <label>Type of Phone 2<input className="admin-input" readOnly value={legacyValue("typePhone2") || "—"} /></label>
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
              </div>
            </div>

            <div className="admin-card admin-workbench-section">
              <h3>Registration Fee</h3>
              <div className="admin-form-grid">
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
              <div className="admin-form-grid">
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
              <h2>Mailings</h2>
              <h3>Mailing Options</h3>
              <div className="admin-actions-row">
                <button type="button" className="admin-btn" disabled>Generate Renewal Mailing</button>
                <button type="button" className="admin-btn" disabled>Generate Prospective Mailing</button>
                <button type="button" className="admin-btn" disabled>Custom Mailing</button>
              </div>
              <div className="admin-form-grid" style={{ maxWidth: "32rem" }}>
                <label>
                  Mailing Date
                  <input
                    className="admin-input"
                    value={legacyValue("mailingDraftDate")}
                    onChange={(e) => setLegacy("mailingDraftDate", e.target.value)}
                    disabled={!current}
                  />
                </label>
              </div>
              <div className="admin-checkbox-grid">
                <label>
                  <input type="checkbox" checked={legacyBool("mailIncludeActive")} onChange={(e) => setLegacy("mailIncludeActive", e.target.checked)} disabled={!current} />
                  Include Active Members
                </label>
                <label>
                  <input type="checkbox" checked={legacyBool("mailIncludeProspective")} onChange={(e) => setLegacy("mailIncludeProspective", e.target.checked)} disabled={!current} />
                  Include Prospective Members
                </label>
                <label>
                  <input type="checkbox" checked={legacyBool("mailIncludeInactive")} onChange={(e) => setLegacy("mailIncludeInactive", e.target.checked)} disabled={!current} />
                  Include Inactive Members
                </label>
              </div>
              <p className="admin-readonly-hint">Member-specific mailing options are saved with the record when you click Save Changes.</p>
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
                <button type="button" className="admin-btn" disabled>Print Report</button>
                <button type="button" className="admin-btn" disabled>Export to Excel</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Worksheet" && (
          <div className="admin-workbench-data-entry">
            {current ? (
              <div className="admin-card admin-workbench-section">
                <h2>Worksheet</h2>
                <h3>Member Worksheet</h3>
                <div className="admin-form-grid">
                  <label className="admin-form-span-2">Member Name<input className="admin-input" readOnly value={`${current.firstName} ${current.lastName}`} /></label>
                  <label className="admin-form-span-2">
                    Address
                    <input
                      className="admin-input"
                      readOnly
                      value={[current.addressLine1, current.addressLine2, current.city, current.state, current.postalCode].filter(Boolean).join(", ")}
                    />
                  </label>
                  <label>Oil Company<input className="admin-input" readOnly value={current.oilCompanyId?.name || "—"} /></label>
                  <label>Oil ID<input className="admin-input" readOnly value={legacyValue("oilId") || "—"} /></label>
                  <label>Status<input className="admin-input" readOnly value={legacyValue("workbenchMemberStatus") || current.status} /></label>
                </div>
                <div className="admin-actions-row">
                  <button type="button" className="admin-btn" disabled>Print Worksheet</button>
                  <button type="button" className="admin-btn" disabled>Export to PDF</button>
                </div>
              </div>
            ) : (
              <p className="admin-meta">Select a member to view the worksheet.</p>
            )}
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
                <button type="button" className="admin-btn admin-btn-primary" disabled={!current}>Print Record</button>
                <button type="button" className="admin-btn" disabled={!current}>Preview</button>
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
                <button type="button" className="admin-btn admin-btn-primary" disabled>Run Backup Now</button>
                <button type="button" className="admin-btn" disabled>Schedule Backup</button>
              </div>
              <h3>Backup History</h3>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Date</th><th>Size</th><th>Status</th></tr></thead>
                  <tbody><tr><td colSpan={3}>No history stored in-app.</td></tr></tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "OIL CO FORM" && (
          <div className="admin-workbench-data-entry">
            <div className="admin-card admin-workbench-section">
              <h2>Oil Co Form</h2>
              <h3>Oil Company Information</h3>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Code</th><th>Company Name</th><th>Phone</th><th>Contact</th></tr></thead>
                  <tbody>
                    {oilCompanies.map((oc) => (
                      <tr key={oc._id}>
                        <td>{oilCoDisplayCode(oc)}</td>
                        <td>{oc.name}</td>
                        <td>{oc.contactPhone || "—"}</td>
                        <td>{oc.contactEmail || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Oil Co Worksheet" && (
          <div className="admin-workbench-data-entry">
            <div className="admin-card admin-workbench-section">
              <h2>Oil Co Worksheet</h2>
              <h3>Members by Oil Company</h3>
              <label style={{ display: "block", maxWidth: "24rem", marginBottom: "0.75rem" }}>
                <span className="admin-meta" style={{ display: "block", marginBottom: "0.25rem" }}>Select Oil Company</span>
                <select className="admin-input" value={oilCoWorksheetId} onChange={(e) => setOilCoWorksheetId(e.target.value)}>
                  <option value="">All loaded members</option>
                  {oilCompanies.map((oc) => (
                    <option key={oc._id} value={oc._id}>{oc.name}</option>
                  ))}
                </select>
              </label>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>ID</th><th>Name</th><th>Oil ID</th><th>Status</th></tr></thead>
                  <tbody>
                    {membersForOilWorksheet.map((m) => (
                      <tr
                        key={m._id}
                        onClick={() => {
                          const gi = members.findIndex((x) => x._id === m._id);
                          if (gi >= 0) setIndex(gi);
                        }}
                      >
                        <td>{m.memberNumber || "—"}</td>
                        <td>{m.firstName} {m.lastName}</td>
                        <td>{String((m.legacyProfile as Record<string, unknown> | undefined)?.oilId ?? "—")}</td>
                        <td><span className={`admin-pill${m.status === "active" ? " ok" : ""}`}>{m.status}</span></td>
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
                <button type="button" className="admin-btn admin-btn-primary" disabled={!current}>Generate Letter</button>
                <button type="button" className="admin-btn" disabled={!current}>Preview</button>
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
                <button type="button" className="admin-btn admin-btn-primary" disabled={!current}>Generate Letter</button>
                <button type="button" className="admin-btn" disabled={!current}>Preview</button>
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
                <button type="button" className="admin-btn admin-btn-primary" disabled>Generate Letters</button>
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
                <button type="button" className="admin-btn admin-btn-primary" disabled>Generate Mailing</button>
                <button type="button" className="admin-btn" disabled>Preview List</button>
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
                <button type="button" className="admin-btn admin-btn-primary" disabled>Generate Mailing</button>
                <button type="button" className="admin-btn" disabled>Preview List</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
