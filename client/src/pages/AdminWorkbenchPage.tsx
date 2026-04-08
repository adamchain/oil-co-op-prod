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
const _PHONE_TYPE = ["HOME", "WORK", "CELL"] as const;
const _HOW_JOINED = ["PHO", "WEB", "REF", "MAIL"] as const;
const _REFERRAL_SOURCE = ["CCAG", "MEMBER", "OTHER"] as const;
void _PHONE_TYPE; void _HOW_JOINED; void _REFERRAL_SOURCE;

export default function AdminWorkbenchPage() {
  const { token, member: _staff } = useAuth();
  void _staff;
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
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyEmail, setNewCompanyEmail] = useState("");
  const [newCompanyPhone, setNewCompanyPhone] = useState("");
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
  const [showDetailView, setShowDetailView] = useState(false);

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

  const _recordCount = `${members.length ? index + 1 : 0}`;
  void _recordCount;

  const _nav = (kind: "first" | "prev" | "next" | "last") => {
    if (!members.length) return;
    if (kind === "first") setIndex(0);
    if (kind === "last") setIndex(members.length - 1);
    if (kind === "prev") setIndex((i) => Math.max(0, i - 1));
    if (kind === "next") setIndex((i) => Math.min(members.length - 1, i + 1));
  };
  void _nav;

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

  const _addCompany = async () => {
    if (!token || !newCompanyName.trim()) return;
    await api("/api/admin/oil-companies", {
      method: "POST",
      token,
      body: JSON.stringify({
        name: newCompanyName.trim(),
        contactEmail: newCompanyEmail.trim(),
        contactPhone: newCompanyPhone.trim(),
      }),
    });
    setNewCompanyName("");
    setNewCompanyEmail("");
    setNewCompanyPhone("");
    await loadOilCompanies();
  };
  void _addCompany;

  return (
    <>
      {/* Header Section - matching reference layout */}
      <div className="admin-page-header">
        <h1 className="admin-page-title-main">
          {activeTab === "Data Entry" ? "Members" : activeTab}
        </h1>
        <div className="admin-page-header-actions">
          <button className="admin-btn admin-btn-primary" type="button" onClick={() => void addMember(false)}>
            + New Member
          </button>
        </div>
      </div>

      {/* Tabs Section */}
      <div className="admin-card">
        <div className="admin-workbench-tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`admin-btn admin-tab-btn ${tab === activeTab ? "admin-btn-primary" : ""}`}
              onClick={() => {
                setActiveTab(tab);
                if (tab !== "Data Entry") setShowDetailView(false);
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-card">

        {activeTab === "Data Entry" && !showDetailView && (
          <div className="admin-workbench-data-entry">
            {/* Filters Section */}
            <div className="admin-orders-filters">
              <input
                type="text"
                className="admin-search-input"
                placeholder="Search members..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select className="admin-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="prospective">Prospective</option>
              </select>
              <button className="admin-btn" onClick={() => void loadMembers()} disabled={loading}>
                {loading ? "Loading..." : "Search"}
              </button>
            </div>

            {/* Members Table */}
            <div className="admin-orders-table-wrapper">
              <table className="admin-orders-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Date</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th>Oil Co</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>
                        No members found. Try adjusting your search.
                      </td>
                    </tr>
                  ) : (
                    members.map((m, i) => (
                      <tr key={m._id}>
                        <td>
                          <span className="admin-order-number">#{m.memberNumber || m._id.slice(-5)}</span>
                          <br />
                          <span style={{ color: "var(--admin-muted)", fontSize: "0.85rem" }}>
                            {m.firstName} {m.lastName}
                          </span>
                        </td>
                        <td>{m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "—"}</td>
                        <td>
                          <span style={{ fontSize: "0.9rem" }}>{m.email || "—"}</span>
                          {m.phone && <><br /><span style={{ color: "var(--admin-muted)", fontSize: "0.85rem" }}>{m.phone}</span></>}
                        </td>
                        <td>
                          <span className={`admin-status-badge admin-status-${m.status === "active" ? "new" : m.status === "expired" ? "on-hold" : "cancelled"}`}>
                            {m.status}
                          </span>
                        </td>
                        <td>{m.oilCompanyId?.name || "—"}</td>
                        <td>
                          <button
                            className="admin-action-btn"
                            onClick={() => {
                              setIndex(i);
                              setShowDetailView(true);
                            }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "Data Entry" && showDetailView && current && (
          <div className="admin-workbench-data-entry">
            {/* Back Button */}
            <button className="admin-back-btn" onClick={() => setShowDetailView(false)}>
              &larr; Back to Members
            </button>

            {/* Member Detail Card */}
            <div className="admin-order-detail-card">
              {/* Member Header */}
              <div className={`admin-order-header admin-order-header-${current.status === "active" ? "new" : current.status === "expired" ? "onhold" : "cancelled"}`}>
                <h2 className="admin-order-header-title">
                  Member: #{current.memberNumber || current._id.slice(-5)} — {current.firstName} {current.lastName}
                </h2>
              </div>

              {/* Member Body */}
              <div className="admin-order-body">
                <p className="admin-order-intro">
                  Member since <strong>{current.createdAt ? new Date(current.createdAt).toLocaleDateString() : "Unknown"}</strong>
                </p>

                {/* Member Info Table */}
                <table className="admin-order-products-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Status</td><td>
                      <select
                        className="admin-input"
                        value={legacyValue("workbenchMemberStatus") || "ACTIVE"}
                        onChange={(e) => setLegacy("workbenchMemberStatus", e.target.value)}
                      >
                        {WB_MEMBER_STATUS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td></tr>
                    <tr><td>First Name</td><td><input className="admin-input" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} /></td></tr>
                    <tr><td>Last Name</td><td><input className="admin-input" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} /></td></tr>
                    <tr><td>Email</td><td><input className="admin-input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></td></tr>
                    <tr><td>Phone</td><td><input className="admin-input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></td></tr>
                    <tr><td>Oil Company</td><td>
                      <select className="admin-input" value={form.oilCompanyId} onChange={(e) => setForm((f) => ({ ...f, oilCompanyId: e.target.value }))}>
                        <option value="">—</option>
                        {oilCompanies.map((oc) => (
                          <option key={oc._id} value={oc._id}>{oc.name}</option>
                        ))}
                      </select>
                    </td></tr>
                  </tbody>
                </table>

                {/* Totals Section */}
                <div className="admin-order-totals">
                  <div className="admin-order-total-row">
                    <span className="admin-total-label">Record Type:</span>
                    <span className="admin-total-value">
                      <select className="admin-input" value={legacyValue("recordType") || "IND"} onChange={(e) => setLegacy("recordType", e.target.value)} style={{ width: "auto" }}>
                        {REC_TYPE.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </span>
                  </div>
                  <div className="admin-order-total-row">
                    <span className="admin-total-label">Oil Status:</span>
                    <span className="admin-total-value">
                      <select className="admin-input" value={legacyValue("oilWorkbenchStatus") || "ACTIVE"} onChange={(e) => setLegacy("oilWorkbenchStatus", e.target.value)} style={{ width: "auto" }}>
                        {WB_OIL_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </span>
                  </div>
                  <div className="admin-order-total-row admin-order-total-final">
                    <span className="admin-total-label">Member Status:</span>
                    <span className="admin-total-value">{current.status.toUpperCase()}</span>
                  </div>
                </div>

                {/* Billing Address Section */}
                <div className="admin-billing-section">
                  <h4 className="admin-billing-title">Address</h4>
                  <div className="admin-billing-address">
                    <div className="admin-form-grid">
                      <label>Street No<input className="admin-input" value={legacyValue("streetNo")} onChange={(e) => setLegacy("streetNo", e.target.value)} /></label>
                      <label>Street Name<input className="admin-input" value={form.addressLine1} onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))} /></label>
                      <label>Apt<input className="admin-input" value={legacyValue("aptNo1")} onChange={(e) => setLegacy("aptNo1", e.target.value)} /></label>
                      <label>Address Line 2<input className="admin-input" value={form.addressLine2} onChange={(e) => setForm((f) => ({ ...f, addressLine2: e.target.value }))} /></label>
                      <label>City<input className="admin-input" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} /></label>
                      <label>State<input className="admin-input" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} /></label>
                      <label>Zip<input className="admin-input" value={form.postalCode} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))} /></label>
                      <label>Plus 4<input className="admin-input" value={legacyValue("plus4")} onChange={(e) => setLegacy("plus4", e.target.value)} /></label>
                    </div>
                  </div>
                </div>

                {/* Additional Info Section */}
                <div className="admin-billing-section">
                  <h4 className="admin-billing-title">Oil & Propane</h4>
                  <div className="admin-billing-address">
                    <div className="admin-form-grid">
                      <label>Oil ID<input className="admin-input" value={legacyValue("oilId")} onChange={(e) => setLegacy("oilId", e.target.value)} /></label>
                      <label>Oil Start Date<input className="admin-input" value={legacyValue("oilStartDate")} onChange={(e) => setLegacy("oilStartDate", e.target.value)} /></label>
                      <label>Propane Status
                        <select className="admin-input" value={legacyValue("propaneStatus") || "UNKNOWN"} onChange={(e) => setLegacy("propaneStatus", e.target.value)}>
                          {WB_PROPANE_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </label>
                      <label>Propane ID<input className="admin-input" value={legacyValue("propaneId")} onChange={(e) => setLegacy("propaneId", e.target.value)} /></label>
                      <label>Electric Status
                        <select className="admin-input" value={legacyValue("electricStatus") || "UNKNOWN"} onChange={(e) => setLegacy("electricStatus", e.target.value)}>
                          {ELECTRIC_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </label>
                      <label>Electric Account<input className="admin-input" value={legacyValue("electricAccountNumber")} onChange={(e) => setLegacy("electricAccountNumber", e.target.value)} /></label>
                    </div>
                  </div>
                </div>

                {/* Notes Section */}
                <div className="admin-billing-section">
                  <h4 className="admin-billing-title">Notes</h4>
                  <div className="admin-billing-address">
                    <textarea
                      className="admin-input admin-note-input"
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      style={{ width: "100%", minHeight: "80px" }}
                    />
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="admin-order-footer-message">
                  <div className="admin-actions-row">
                    <button className="admin-btn admin-btn-primary" onClick={() => void saveCurrent()}>Save Changes</button>
                    <button className="admin-btn" onClick={() => void deleteCurrent()}>Delete Member</button>
                  </div>
                </div>
              </div>
            </div>
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
    </>
  );
}
