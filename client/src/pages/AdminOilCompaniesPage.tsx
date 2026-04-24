import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../authContext";

type OilCompany = {
  _id: string;
  name: string;
  contactEmail?: string;
  contactEmails?: string[];
  contactPhone?: string;
  notes?: string;
  active?: boolean;
};

type EditState = {
  oilCoCode: string;
  name: string;
  oilCoAddress: string;
  oilCoCity: string;
  oilCoState: string;
  oilCoZip: string;
  oilCoFax: string;
  oilCoContact: string;
  oilCoContactEmail: string;
  oilCoContact2: string;
  oilCoContact2Email: string;
  oilCoContact3: string;
  oilCoContact3Email: string;
  contactPhone: string;
};

function contactEmailsArray(oc: OilCompany): string[] {
  if (Array.isArray(oc.contactEmails) && oc.contactEmails.length > 0) {
    return oc.contactEmails.map((e) => e.trim().toLowerCase()).filter(Boolean);
  }
  return oc.contactEmail ? [oc.contactEmail.trim().toLowerCase()] : [];
}

function parseEmails(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  raw
    .split(/[\n,;]+/)
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
    .forEach((email) => {
      if (!seen.has(email)) {
        seen.add(email);
        out.push(email);
      }
    });
  return out;
}

type ParsedOilCompanyDetails = {
  oilCoCode: string;
  oilCoAddress: string;
  oilCoCity: string;
  oilCoState: string;
  oilCoZip: string;
  oilCoFax: string;
  oilCoContact: string;
  oilCoContactEmail: string;
  oilCoContact2: string;
  oilCoContact2Email: string;
  oilCoContact3: string;
  oilCoContact3Email: string;
};

function parseNotes(notes?: string): ParsedOilCompanyDetails {
  const out: ParsedOilCompanyDetails = {
    oilCoCode: "",
    oilCoAddress: "",
    oilCoCity: "",
    oilCoState: "",
    oilCoZip: "",
    oilCoFax: "",
    oilCoContact: "",
    oilCoContactEmail: "",
    oilCoContact2: "",
    oilCoContact2Email: "",
    oilCoContact3: "",
    oilCoContact3Email: "",
  };
  if (!notes) return out;

  const parts = notes.split("|").map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    if (part.startsWith("Code: ")) out.oilCoCode = part.slice(6).trim();
    if (part.startsWith("Fax: ")) out.oilCoFax = part.slice(5).trim();
    if (part.startsWith("Primary contact: ")) out.oilCoContact = part.slice(17).trim();
    if (part.startsWith("Primary contact email: ")) out.oilCoContactEmail = part.slice(23).trim();
    if (part.startsWith("Secondary contact: ")) out.oilCoContact2 = part.slice(19).trim();
    if (part.startsWith("Secondary contact email: ")) out.oilCoContact2Email = part.slice(25).trim();
    if (part.startsWith("Tertiary contact: ")) out.oilCoContact3 = part.slice(18).trim();
    if (part.startsWith("Tertiary contact email: ")) out.oilCoContact3Email = part.slice(24).trim();
    if (part.startsWith("Address: ")) {
      const rawAddress = part.slice(9).trim();
      const segments = rawAddress.split(",").map((s) => s.trim()).filter(Boolean);
      if (segments.length >= 4) {
        out.oilCoZip = segments.pop() || "";
        out.oilCoState = segments.pop() || "";
        out.oilCoCity = segments.pop() || "";
        out.oilCoAddress = segments.join(", ");
      } else {
        out.oilCoAddress = rawAddress;
      }
    }
  }
  return out;
}

function buildNotes(edit: EditState): string {
  const parts: string[] = [];
  if (edit.oilCoCode.trim()) parts.push(`Code: ${edit.oilCoCode.trim()}`);
  const addressBits = [edit.oilCoAddress, edit.oilCoCity, edit.oilCoState, edit.oilCoZip]
    .map((v) => v.trim())
    .filter(Boolean);
  if (addressBits.length) parts.push(`Address: ${addressBits.join(", ")}`);
  if (edit.oilCoFax.trim()) parts.push(`Fax: ${edit.oilCoFax.trim()}`);
  if (edit.oilCoContact.trim()) parts.push(`Primary contact: ${edit.oilCoContact.trim()}`);
  if (edit.oilCoContactEmail.trim()) parts.push(`Primary contact email: ${edit.oilCoContactEmail.trim().toLowerCase()}`);
  if (edit.oilCoContact2.trim()) parts.push(`Secondary contact: ${edit.oilCoContact2.trim()}`);
  if (edit.oilCoContact2Email.trim()) parts.push(`Secondary contact email: ${edit.oilCoContact2Email.trim().toLowerCase()}`);
  if (edit.oilCoContact3.trim()) parts.push(`Tertiary contact: ${edit.oilCoContact3.trim()}`);
  if (edit.oilCoContact3Email.trim()) parts.push(`Tertiary contact email: ${edit.oilCoContact3Email.trim().toLowerCase()}`);
  return parts.join(" | ");
}

function toEditState(oc: OilCompany): EditState {
  const parsed = parseNotes(oc.notes);
  const emails = contactEmailsArray(oc);
  return {
    oilCoCode: parsed.oilCoCode,
    name: oc.name || "",
    oilCoAddress: parsed.oilCoAddress,
    oilCoCity: parsed.oilCoCity,
    oilCoState: parsed.oilCoState,
    oilCoZip: parsed.oilCoZip,
    oilCoFax: parsed.oilCoFax,
    oilCoContact: parsed.oilCoContact,
    oilCoContactEmail: parsed.oilCoContactEmail || emails[0] || "",
    oilCoContact2: parsed.oilCoContact2,
    oilCoContact2Email: parsed.oilCoContact2Email || emails[1] || "",
    oilCoContact3: parsed.oilCoContact3,
    oilCoContact3Email: parsed.oilCoContact3Email || emails[2] || "",
    contactPhone: oc.contactPhone || "",
  };
}

export default function AdminOilCompaniesPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<OilCompany[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [companyFilter, setCompanyFilter] = useState("");
  const [sortKey, setSortKey] = useState<"code" | "name" | "address" | "city" | "state" | "zip" | "phone" | "fax" | "contact1" | "email1" | "contact2" | "email2" | "contact3" | "email3">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [edit, setEdit] = useState<EditState>({
    oilCoCode: "",
    name: "",
    oilCoAddress: "",
    oilCoCity: "",
    oilCoState: "",
    oilCoZip: "",
    oilCoFax: "",
    oilCoContact: "",
    oilCoContactEmail: "",
    oilCoContact2: "",
    oilCoContact2Email: "",
    oilCoContact3: "",
    oilCoContact3Email: "",
    contactPhone: "",
  });
  const [newRow, setNewRow] = useState<EditState>({
    oilCoCode: "",
    name: "",
    oilCoAddress: "",
    oilCoCity: "",
    oilCoState: "",
    oilCoZip: "",
    oilCoFax: "",
    oilCoContact: "",
    oilCoContactEmail: "",
    oilCoContact2: "",
    oilCoContact2Email: "",
    oilCoContact3: "",
    oilCoContact3Email: "",
    contactPhone: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const filteredSortedRows = useMemo(() => {
    const base = companyFilter
      ? rows.filter((r) => r._id === companyFilter)
      : rows.slice();
    const readValue = (r: OilCompany): string => {
      const parsed = parseNotes(r.notes);
      if (sortKey === "code") return parsed.oilCoCode;
      if (sortKey === "name") return r.name;
      if (sortKey === "address") return parsed.oilCoAddress;
      if (sortKey === "city") return parsed.oilCoCity;
      if (sortKey === "state") return parsed.oilCoState;
      if (sortKey === "zip") return parsed.oilCoZip;
      if (sortKey === "phone") return r.contactPhone || "";
      if (sortKey === "fax") return parsed.oilCoFax;
      if (sortKey === "contact1") return parsed.oilCoContact;
      if (sortKey === "email1") return parsed.oilCoContactEmail;
      if (sortKey === "contact2") return parsed.oilCoContact2;
      if (sortKey === "email2") return parsed.oilCoContact2Email;
      if (sortKey === "contact3") return parsed.oilCoContact3;
      return parsed.oilCoContact3Email;
    };
    return base.sort((a, b) => {
      const av = readValue(a).toLowerCase();
      const bv = readValue(b).toLowerCase();
      const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, companyFilter, sortKey, sortDir]);

  function toggleSort(nextKey: typeof sortKey) {
    if (sortKey === nextKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDir("asc");
  }

  async function load() {
    if (!token) return;
    const res = await api<{ oilCompanies: OilCompany[] }>("/api/admin/oil-companies", { token });
    setRows(res.oilCompanies || []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const activeCount = useMemo(() => rows.filter((r) => r.active !== false).length, [rows]);

  async function saveEdit(id: string) {
    if (!token) return;
    setSaving(true);
    setMsg("");
    try {
      const contactEmails = parseEmails(
        [edit.oilCoContactEmail, edit.oilCoContact2Email, edit.oilCoContact3Email].filter(Boolean).join(",")
      );
      await api(`/api/admin/oil-companies/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          name: edit.name,
          contactPhone: edit.contactPhone,
          notes: buildNotes(edit),
          contactEmails,
          contactEmail: contactEmails[0] || "",
        }),
      });
      setEditingId(null);
      await load();
      setMsg("Oil company updated.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(id: string) {
    if (!token) return;
    const ok = window.confirm("Delete this oil company? If members are assigned, it will be set inactive.");
    if (!ok) return;
    setSaving(true);
    setMsg("");
    try {
      const res = await api<{ softDeleted?: boolean; message?: string }>(`/api/admin/oil-companies/${id}`, {
        method: "DELETE",
        token,
      });
      setEditingId(null);
      await load();
      setMsg(res.message || (res.softDeleted ? "Oil company deactivated." : "Oil company deleted."));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  async function createRow() {
    if (!token || !newRow.name.trim()) return;
    setSaving(true);
    setMsg("");
    try {
      const contactEmails = parseEmails(
        [newRow.oilCoContactEmail, newRow.oilCoContact2Email, newRow.oilCoContact3Email].filter(Boolean).join(",")
      );
      await api("/api/admin/oil-companies", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: newRow.name,
          contactPhone: newRow.contactPhone,
          notes: buildNotes(newRow),
          contactEmails,
          contactEmail: contactEmails[0] || "",
        }),
      });
      setNewRow({
        oilCoCode: "",
        name: "",
        oilCoAddress: "",
        oilCoCity: "",
        oilCoState: "",
        oilCoZip: "",
        oilCoFax: "",
        oilCoContact: "",
        oilCoContactEmail: "",
        oilCoContact2: "",
        oilCoContact2Email: "",
        oilCoContact3: "",
        oilCoContact3Email: "",
        contactPhone: "",
      });
      await load();
      setMsg("Oil company added.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-oil-companies-page">
      <p style={{ color: "var(--admin-muted)", fontSize: "0.875rem", margin: "0 0 1rem" }}>
        Manage oil company records. All 12 import fields are shown below.
      </p>

      <div className="admin-card">
        <h2>Oil Companies</h2>
        {msg && <p className="admin-meta" style={{ margin: "0 0 0.75rem" }}>{msg}</p>}
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap" }}>
          <select className="admin-input" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} style={{ maxWidth: "360px" }}>
            <option value="">All Oil Companies</option>
            {rows
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((oc) => (
                <option key={oc._id} value={oc._id}>
                  {oc.name}
                </option>
              ))}
          </select>
          <span className="admin-meta">{filteredSortedRows.length} row(s) · {activeCount} active · {rows.length} total</span>
        </div>
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 2,
            background: "var(--admin-surface)",
            border: "0.5px solid var(--admin-border)",
            borderRadius: "12px",
            padding: "0.75rem",
            marginBottom: "0.75rem",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(120px, 1fr)) auto", gap: "0.5rem", alignItems: "center" }}>
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.oilCoCode} onChange={(e) => setNewRow((s) => ({ ...s, oilCoCode: e.target.value }))} placeholder="Code" />
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.name} onChange={(e) => setNewRow((s) => ({ ...s, name: e.target.value }))} placeholder="Name" />
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.oilCoAddress} onChange={(e) => setNewRow((s) => ({ ...s, oilCoAddress: e.target.value }))} placeholder="Address" />
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.oilCoCity} onChange={(e) => setNewRow((s) => ({ ...s, oilCoCity: e.target.value }))} placeholder="City" />
            <input className="admin-input" style={{ minWidth: 0, maxWidth: "64px" }} value={newRow.oilCoState} onChange={(e) => setNewRow((s) => ({ ...s, oilCoState: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="ST" />
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.oilCoZip} onChange={(e) => setNewRow((s) => ({ ...s, oilCoZip: e.target.value }))} placeholder="Zip" />
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.contactPhone} onChange={(e) => setNewRow((s) => ({ ...s, contactPhone: e.target.value }))} placeholder="Phone" />
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.oilCoFax} onChange={(e) => setNewRow((s) => ({ ...s, oilCoFax: e.target.value }))} placeholder="Fax" />
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.oilCoContact} onChange={(e) => setNewRow((s) => ({ ...s, oilCoContact: e.target.value }))} placeholder="Contact 1" />
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.oilCoContactEmail} onChange={(e) => setNewRow((s) => ({ ...s, oilCoContactEmail: e.target.value }))} placeholder="Email 1" />
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.oilCoContact2} onChange={(e) => setNewRow((s) => ({ ...s, oilCoContact2: e.target.value }))} placeholder="Contact 2" />
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.oilCoContact2Email} onChange={(e) => setNewRow((s) => ({ ...s, oilCoContact2Email: e.target.value }))} placeholder="Email 2" />
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.oilCoContact3} onChange={(e) => setNewRow((s) => ({ ...s, oilCoContact3: e.target.value }))} placeholder="Contact 3" />
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.oilCoContact3Email} onChange={(e) => setNewRow((s) => ({ ...s, oilCoContact3Email: e.target.value }))} placeholder="Email 3" />
            <button type="button" className="admin-btn" onClick={createRow} disabled={saving || !newRow.name.trim()}>
              Add Oil Company
            </button>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th><button type="button" className="admin-btn admin-btn-ghost" onClick={() => toggleSort("code")}>Code</button></th>
                <th><button type="button" className="admin-btn admin-btn-ghost" onClick={() => toggleSort("name")}>Name</button></th>
                <th><button type="button" className="admin-btn admin-btn-ghost" onClick={() => toggleSort("address")}>Address</button></th>
                <th><button type="button" className="admin-btn admin-btn-ghost" onClick={() => toggleSort("city")}>City</button></th>
                <th><button type="button" className="admin-btn admin-btn-ghost" onClick={() => toggleSort("state")}>St</button></th>
                <th><button type="button" className="admin-btn admin-btn-ghost" onClick={() => toggleSort("zip")}>Zip</button></th>
                <th><button type="button" className="admin-btn admin-btn-ghost" onClick={() => toggleSort("phone")}>Phone</button></th>
                <th><button type="button" className="admin-btn admin-btn-ghost" onClick={() => toggleSort("fax")}>Fax</button></th>
                <th><button type="button" className="admin-btn admin-btn-ghost" onClick={() => toggleSort("contact1")}>Contact 1</button></th>
                <th><button type="button" className="admin-btn admin-btn-ghost" onClick={() => toggleSort("email1")}>Email 1</button></th>
                <th><button type="button" className="admin-btn admin-btn-ghost" onClick={() => toggleSort("contact2")}>Contact 2</button></th>
                <th><button type="button" className="admin-btn admin-btn-ghost" onClick={() => toggleSort("email2")}>Email 2</button></th>
                <th><button type="button" className="admin-btn admin-btn-ghost" onClick={() => toggleSort("contact3")}>Contact 3</button></th>
                <th><button type="button" className="admin-btn admin-btn-ghost" onClick={() => toggleSort("email3")}>Email 3</button></th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSortedRows.map((r) => {
                const isEditing = editingId === r._id;
                const parsed = parseNotes(r.notes);
                return (
                  <tr key={r._id}>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "80px" }} value={edit.oilCoCode} onChange={(e) => setEdit((s) => ({ ...s, oilCoCode: e.target.value }))} /> : (parsed.oilCoCode || "—")}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "180px" }} value={edit.name} onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))} /> : r.name}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "220px" }} value={edit.oilCoAddress} onChange={(e) => setEdit((s) => ({ ...s, oilCoAddress: e.target.value }))} /> : (parsed.oilCoAddress || "—")}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "140px" }} value={edit.oilCoCity} onChange={(e) => setEdit((s) => ({ ...s, oilCoCity: e.target.value }))} /> : (parsed.oilCoCity || "—")}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "56px", maxWidth: "64px" }} value={edit.oilCoState} onChange={(e) => setEdit((s) => ({ ...s, oilCoState: e.target.value.toUpperCase().slice(0, 2) }))} /> : (parsed.oilCoState || "—")}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "100px" }} value={edit.oilCoZip} onChange={(e) => setEdit((s) => ({ ...s, oilCoZip: e.target.value }))} /> : (parsed.oilCoZip || "—")}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "140px" }} value={edit.contactPhone} onChange={(e) => setEdit((s) => ({ ...s, contactPhone: e.target.value }))} /> : (r.contactPhone || "—")}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "140px" }} value={edit.oilCoFax} onChange={(e) => setEdit((s) => ({ ...s, oilCoFax: e.target.value }))} /> : (parsed.oilCoFax || "—")}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "180px" }} value={edit.oilCoContact} onChange={(e) => setEdit((s) => ({ ...s, oilCoContact: e.target.value }))} /> : (parsed.oilCoContact || "—")}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "180px" }} value={edit.oilCoContactEmail} onChange={(e) => setEdit((s) => ({ ...s, oilCoContactEmail: e.target.value }))} /> : (parsed.oilCoContactEmail || contactEmailsArray(r)[0] || "—")}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "180px" }} value={edit.oilCoContact2} onChange={(e) => setEdit((s) => ({ ...s, oilCoContact2: e.target.value }))} /> : (parsed.oilCoContact2 || "—")}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "180px" }} value={edit.oilCoContact2Email} onChange={(e) => setEdit((s) => ({ ...s, oilCoContact2Email: e.target.value }))} /> : (parsed.oilCoContact2Email || contactEmailsArray(r)[1] || "—")}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "180px" }} value={edit.oilCoContact3} onChange={(e) => setEdit((s) => ({ ...s, oilCoContact3: e.target.value }))} /> : (parsed.oilCoContact3 || "—")}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "180px" }} value={edit.oilCoContact3Email} onChange={(e) => setEdit((s) => ({ ...s, oilCoContact3Email: e.target.value }))} /> : (parsed.oilCoContact3Email || contactEmailsArray(r)[2] || "—")}</td>
                    <td>{r.active === false ? "inactive" : "active"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {isEditing ? (
                        <>
                          <button type="button" className="admin-btn" onClick={() => void saveEdit(r._id)} disabled={saving || !edit.name.trim()}>
                            Save
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn-ghost"
                            onClick={() => void deleteRow(r._id)}
                            disabled={saving}
                            style={{ marginLeft: "0.4rem", color: "#b42318" }}
                          >
                            Delete
                          </button>
                          <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setEditingId(null)} style={{ marginLeft: "0.4rem" }}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="admin-btn"
                          onClick={() => {
                            setEditingId(r._id);
                            setEdit(toEditState(r));
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
