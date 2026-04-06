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
};

type OilCompany = { _id: string; name: string; contactEmail?: string; contactPhone?: string };
type BillingEvent = { _id: string; kind: string; status: string; amountCents: number; billingYear?: number; createdAt: string };
type Comm = { _id: string; channel: string; subject?: string; status: string; createdAt: string };
type Referral = { referrerMemberId?: { firstName?: string; lastName?: string; email?: string } };

export default function AdminWorkbenchPage() {
  const { token, member: staff } = useAuth();
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
    status: "active" as Member["status"],
    oilCompanyId: "",
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
      status: current.status,
      oilCompanyId: current.oilCompanyId?._id || "",
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
    await api(`/api/admin/members/${current._id}`, { method: "PATCH", token, body: JSON.stringify(form) });
    await loadMembers();
  };

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

  const addCompany = async () => {
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

  return (
    <>
      <div className="admin-card">
        <div className="admin-toolbar">
          <div className="admin-toolbar-nav">
            <button className="admin-btn" onClick={() => nav("first")}>|&lt;</button>
            <button className="admin-btn" onClick={() => nav("prev")}>&lt;</button>
            <button className="admin-btn" onClick={() => nav("next")}>&gt;</button>
            <button className="admin-btn" onClick={() => nav("last")}>&gt;|</button>
          </div>
          <input className="admin-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search any field..." />
          <select className="admin-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Records</option>
            <option value="active">Active Members</option>
            <option value="inactive">Inactive Members</option>
            <option value="prospective">Prospective</option>
          </select>
          <button className="admin-btn" onClick={() => void loadMembers()} disabled={loading}>{loading ? "Loading..." : "Search"}</button>
          <span className="admin-meta">
            Record {recordCount} | Found {members.length} of {members.length}
          </span>
          <span className="admin-meta">
            Staff: {staff?.firstName || "Admin"} {staff?.lastName || "User"}
          </span>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-workbench-tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`admin-btn admin-tab-btn ${tab === activeTab ? "admin-btn-primary" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-actions-row">
          <button className="admin-btn admin-btn-primary" onClick={() => void addMember(false)}>ADD NEW MEMBER</button>
          <button className="admin-btn" onClick={() => void addMember(true)}>ADD PROSPECT</button>
          <button className="admin-btn" onClick={() => void deleteCurrent()}>DELETE THIS MEMBER</button>
          <button className="admin-btn" onClick={() => void saveCurrent()}>SAVE CHANGES</button>
        </div>

        {activeTab === "Data Entry" && current && (
          <div className="admin-workbench-grid">
            <div className="admin-card" style={{ marginBottom: 0 }}>
              <h2>Member Identity</h2>
              <div className="admin-form-grid">
                <label>First Name 1<input className="admin-input" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} /></label>
                <label>Last Name 1<input className="admin-input" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} /></label>
                <label>E_mail<input className="admin-input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></label>
                <label>Phone_1<input className="admin-input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></label>
                <label>Street_nm<input className="admin-input" value={form.addressLine1} onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))} /></label>
                <label>Address Line2<input className="admin-input" value={form.addressLine2} onChange={(e) => setForm((f) => ({ ...f, addressLine2: e.target.value }))} /></label>
                <label>City<input className="admin-input" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} /></label>
                <label>State<input className="admin-input" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} /></label>
                <label>Zip<input className="admin-input" value={form.postalCode} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))} /></label>
                <label>Status
                  <select className="admin-input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Member["status"] }))}>
                    <option value="active">ACTIVE</option>
                    <option value="expired">INACTIVE</option>
                    <option value="cancelled">CANCELLED</option>
                  </select>
                </label>
                <label>Oil Co Code
                  <select className="admin-input" value={form.oilCompanyId} onChange={(e) => setForm((f) => ({ ...f, oilCompanyId: e.target.value }))}>
                    <option value="">Unassigned</option>
                    {oilCompanies.map((oc) => (
                      <option key={oc._id} value={oc._id}>{oc.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="admin-note-field">
                Note
                <textarea className="admin-input admin-note-input" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </label>
            </div>
            <div className="admin-card" style={{ marginBottom: 0 }}>
              <h2>Oil Company / Quick Add</h2>
              <div className="admin-form-grid">
                <label>Company Name<input className="admin-input" value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} /></label>
                <label>Contact Email<input className="admin-input" value={newCompanyEmail} onChange={(e) => setNewCompanyEmail(e.target.value)} /></label>
                <label>Contact Phone<input className="admin-input" value={newCompanyPhone} onChange={(e) => setNewCompanyPhone(e.target.value)} /></label>
              </div>
              <button className="admin-btn admin-small-top" onClick={() => void addCompany()}>ADD NEW CO.</button>
              <h2 className="admin-section-gap">Current Record</h2>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <tbody>
                    <tr><th>ID</th><td>{current.memberNumber || "—"}</td></tr>
                    <tr><th>New Member Dt</th><td>{current.createdAt ? new Date(current.createdAt).toLocaleDateString() : "—"}</td></tr>
                    <tr><th>Oil Co</th><td>{current.oilCompanyId?.name || "Unassigned"}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "PAYMENT HISTORY" && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Date</th><th>Kind</th><th>Status</th><th>Amount</th><th>Year</th></tr></thead>
              <tbody>
                {billing.map((b) => (
                  <tr key={b._id}>
                    <td>{new Date(b.createdAt).toLocaleDateString()}</td>
                    <td>{b.kind}</td>
                    <td><span className={`admin-pill${b.status === "succeeded" || b.status === "mock" ? " ok" : ""}`}>{b.status}</span></td>
                    <td>${(b.amountCents / 100).toFixed(2)}</td>
                    <td>{b.billingYear || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "MAILINGS" && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Date</th><th>Channel</th><th>Subject</th><th>Status</th></tr></thead>
              <tbody>
                {communications.map((c) => (
                  <tr key={c._id}>
                    <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td>{c.channel}</td>
                    <td>{c.subject || "—"}</td>
                    <td><span className={`admin-pill${c.status === "sent" ? " ok" : ""}`}>{c.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Member #</th><th>Name</th><th>Email</th><th>Oil company</th><th>Status</th></tr></thead>
              <tbody>
                {members.map((m, i) => (
                  <tr key={m._id} onClick={() => setIndex(i)}>
                    <td>{m.memberNumber || "—"}</td>
                    <td>{m.firstName} {m.lastName}</td>
                    <td>{m.email}</td>
                    <td>{m.oilCompanyId?.name || "—"}</td>
                    <td><span className={`admin-pill${m.status === "active" ? " ok" : ""}`}>{m.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "MEMBER STATUS RPT" && (
          <div className="admin-stats">
            <div className="admin-stat"><strong>{stats.active}</strong><span>Active Members</span></div>
            <div className="admin-stat"><strong>{stats.inactive}</strong><span>Inactive Members</span></div>
            <div className="admin-stat"><strong>{members.filter((m) => (m.notes || "").toLowerCase().includes("prospect")).length}</strong><span>Prospective</span></div>
            <div className="admin-stat"><strong>{stats.total}</strong><span>Total</span></div>
          </div>
        )}

        {(activeTab === "Worksheet" ||
          activeTab === "PRINT FULL RECORD" ||
          activeTab === "RUN BACKUP" ||
          activeTab === "OIL CO FORM" ||
          activeTab === "Oil Co Worksheet" ||
          activeTab === "REFUND LETTER" ||
          activeTab === "START DATE LETTER" ||
          activeTab === "Multiple Referral Letter" ||
          activeTab === "Renewal Mailing" ||
          activeTab === "Prospective Mailing") && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Module</th><th>Current Member</th><th>Status</th></tr></thead>
              <tbody>
                <tr>
                  <td>{activeTab}</td>
                  <td>{current ? `${current.firstName} ${current.lastName}` : "—"}</td>
                  <td><span className="admin-pill ok">Live DB</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
