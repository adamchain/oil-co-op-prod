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
  contactEmails: string;
  oilCoContact: string;
  oilCoContact2: string;
  oilCoContact2Phone: string;
  contactPhone: string;
};

function emailsToInput(oc: OilCompany): string {
  if (Array.isArray(oc.contactEmails) && oc.contactEmails.length > 0) {
    return oc.contactEmails.join(", ");
  }
  return oc.contactEmail || "";
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
  oilCoContact2: string;
  oilCoContact2Phone: string;
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
    oilCoContact2: "",
    oilCoContact2Phone: "",
  };
  if (!notes) return out;

  const parts = notes.split("|").map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    if (part.startsWith("Code: ")) out.oilCoCode = part.slice(6).trim();
    if (part.startsWith("Fax: ")) out.oilCoFax = part.slice(5).trim();
    if (part.startsWith("Primary contact: ")) out.oilCoContact = part.slice(17).trim();
    if (part.startsWith("Secondary contact: ")) out.oilCoContact2 = part.slice(19).trim();
    if (part.startsWith("Secondary contact phone: ")) out.oilCoContact2Phone = part.slice(25).trim();
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
  if (edit.oilCoContact2.trim()) parts.push(`Secondary contact: ${edit.oilCoContact2.trim()}`);
  if (edit.oilCoContact2Phone.trim()) parts.push(`Secondary contact phone: ${edit.oilCoContact2Phone.trim()}`);
  return parts.join(" | ");
}

function toEditState(oc: OilCompany): EditState {
  const parsed = parseNotes(oc.notes);
  return {
    oilCoCode: parsed.oilCoCode,
    name: oc.name || "",
    oilCoAddress: parsed.oilCoAddress,
    oilCoCity: parsed.oilCoCity,
    oilCoState: parsed.oilCoState,
    oilCoZip: parsed.oilCoZip,
    oilCoFax: parsed.oilCoFax,
    contactEmails: emailsToInput(oc),
    oilCoContact: parsed.oilCoContact,
    oilCoContact2: parsed.oilCoContact2,
    oilCoContact2Phone: parsed.oilCoContact2Phone,
    contactPhone: oc.contactPhone || "",
  };
}

export default function AdminOilCompaniesPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<OilCompany[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState>({
    oilCoCode: "",
    name: "",
    oilCoAddress: "",
    oilCoCity: "",
    oilCoState: "",
    oilCoZip: "",
    oilCoFax: "",
    contactEmails: "",
    oilCoContact: "",
    oilCoContact2: "",
    oilCoContact2Phone: "",
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
    contactEmails: "",
    oilCoContact: "",
    oilCoContact2: "",
    oilCoContact2Phone: "",
    contactPhone: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

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
      await api(`/api/admin/oil-companies/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          name: edit.name,
          contactPhone: edit.contactPhone,
          notes: buildNotes(edit),
          contactEmails: parseEmails(edit.contactEmails),
          contactEmail: parseEmails(edit.contactEmails)[0] || "",
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
      await api("/api/admin/oil-companies", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: newRow.name,
          contactPhone: newRow.contactPhone,
          notes: buildNotes(newRow),
          contactEmails: parseEmails(newRow.contactEmails),
          contactEmail: parseEmails(newRow.contactEmails)[0] || "",
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
        contactEmails: "",
        oilCoContact: "",
        oilCoContact2: "",
        oilCoContact2Phone: "",
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
    <>
      <p style={{ color: "var(--admin-muted)", fontSize: "0.875rem", margin: "0 0 1rem" }}>
        Manage oil company records. All 12 import fields are shown below.
      </p>

      <div className="admin-stats">
        <div className="admin-stat">
          <strong>{rows.length}</strong>
          <span>Total companies</span>
        </div>
        <div className="admin-stat">
          <strong>{activeCount}</strong>
          <span>Active companies</span>
        </div>
      </div>

      <div className="admin-card">
        <h2>Oil Companies</h2>
        {msg && <p className="admin-meta" style={{ margin: "0 0 0.75rem" }}>{msg}</p>}
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(140px, 1fr)) auto", gap: "0.5rem", alignItems: "center" }}>
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.oilCoCode} onChange={(e) => setNewRow((s) => ({ ...s, oilCoCode: e.target.value }))} placeholder="Code" />
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.name} onChange={(e) => setNewRow((s) => ({ ...s, name: e.target.value }))} placeholder="Name" />
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.oilCoAddress} onChange={(e) => setNewRow((s) => ({ ...s, oilCoAddress: e.target.value }))} placeholder="Address" />
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.oilCoCity} onChange={(e) => setNewRow((s) => ({ ...s, oilCoCity: e.target.value }))} placeholder="City" />
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.oilCoState} onChange={(e) => setNewRow((s) => ({ ...s, oilCoState: e.target.value }))} placeholder="State" />
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.oilCoZip} onChange={(e) => setNewRow((s) => ({ ...s, oilCoZip: e.target.value }))} placeholder="Zip" />
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.contactPhone} onChange={(e) => setNewRow((s) => ({ ...s, contactPhone: e.target.value }))} placeholder="Phone" />
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.oilCoFax} onChange={(e) => setNewRow((s) => ({ ...s, oilCoFax: e.target.value }))} placeholder="Fax" />
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.contactEmails} onChange={(e) => setNewRow((s) => ({ ...s, contactEmails: e.target.value }))} placeholder="Contact Email(s)" />
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.oilCoContact} onChange={(e) => setNewRow((s) => ({ ...s, oilCoContact: e.target.value }))} placeholder="Contact 1" />
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.oilCoContact2} onChange={(e) => setNewRow((s) => ({ ...s, oilCoContact2: e.target.value }))} placeholder="Contact 2" />
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.oilCoContact2Phone} onChange={(e) => setNewRow((s) => ({ ...s, oilCoContact2Phone: e.target.value }))} placeholder="Contact 2 Phone" />
            <button type="button" className="admin-btn" onClick={createRow} disabled={saving || !newRow.name.trim()}>
              Add Oil Company
            </button>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Address</th>
                <th>City</th>
                <th>State</th>
                <th>Zip</th>
                <th>Phone</th>
                <th>Fax</th>
                <th>Contact Email</th>
                <th>Contact 1</th>
                <th>Contact 2</th>
                <th>Contact 2 Phone</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isEditing = editingId === r._id;
                const parsed = parseNotes(r.notes);
                return (
                  <tr key={r._id}>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "80px" }} value={edit.oilCoCode} onChange={(e) => setEdit((s) => ({ ...s, oilCoCode: e.target.value }))} /> : (parsed.oilCoCode || "—")}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "180px" }} value={edit.name} onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))} /> : r.name}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "220px" }} value={edit.oilCoAddress} onChange={(e) => setEdit((s) => ({ ...s, oilCoAddress: e.target.value }))} /> : (parsed.oilCoAddress || "—")}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "140px" }} value={edit.oilCoCity} onChange={(e) => setEdit((s) => ({ ...s, oilCoCity: e.target.value }))} /> : (parsed.oilCoCity || "—")}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "80px" }} value={edit.oilCoState} onChange={(e) => setEdit((s) => ({ ...s, oilCoState: e.target.value }))} /> : (parsed.oilCoState || "—")}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "100px" }} value={edit.oilCoZip} onChange={(e) => setEdit((s) => ({ ...s, oilCoZip: e.target.value }))} /> : (parsed.oilCoZip || "—")}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "140px" }} value={edit.contactPhone} onChange={(e) => setEdit((s) => ({ ...s, contactPhone: e.target.value }))} /> : (r.contactPhone || "—")}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "140px" }} value={edit.oilCoFax} onChange={(e) => setEdit((s) => ({ ...s, oilCoFax: e.target.value }))} /> : (parsed.oilCoFax || "—")}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "220px" }} value={edit.contactEmails} onChange={(e) => setEdit((s) => ({ ...s, contactEmails: e.target.value }))} placeholder="a@co.com, b@co.com" /> : (emailsToInput(r) || "—")}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "180px" }} value={edit.oilCoContact} onChange={(e) => setEdit((s) => ({ ...s, oilCoContact: e.target.value }))} /> : (parsed.oilCoContact || "—")}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "180px" }} value={edit.oilCoContact2} onChange={(e) => setEdit((s) => ({ ...s, oilCoContact2: e.target.value }))} /> : (parsed.oilCoContact2 || "—")}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "160px" }} value={edit.oilCoContact2Phone} onChange={(e) => setEdit((s) => ({ ...s, oilCoContact2Phone: e.target.value }))} /> : (parsed.oilCoContact2Phone || "—")}</td>
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
    </>
  );
}
