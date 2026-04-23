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
  name: string;
  contactEmails: string;
  contactPhone: string;
  notes: string;
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

function toEditState(oc: OilCompany): EditState {
  return {
    name: oc.name || "",
    contactEmails: emailsToInput(oc),
    contactPhone: oc.contactPhone || "",
    notes: oc.notes || "",
  };
}

export default function AdminOilCompaniesPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<OilCompany[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState>({ name: "", contactEmails: "", contactPhone: "", notes: "" });
  const [newRow, setNewRow] = useState<EditState>({ name: "", contactEmails: "", contactPhone: "", notes: "" });
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
          ...edit,
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
          ...newRow,
          contactEmails: parseEmails(newRow.contactEmails),
          contactEmail: parseEmails(newRow.contactEmails)[0] || "",
        }),
      });
      setNewRow({ name: "", contactEmails: "", contactPhone: "", notes: "" });
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
        Manage oil company records. Add multiple emails separated by commas.
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
          <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1.1fr) minmax(260px, 1.8fr) minmax(160px, 1fr) minmax(220px, 1.6fr) auto", gap: "0.5rem", alignItems: "center" }}>
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.name} onChange={(e) => setNewRow((s) => ({ ...s, name: e.target.value }))} placeholder="New company name" />
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.contactEmails} onChange={(e) => setNewRow((s) => ({ ...s, contactEmails: e.target.value }))} placeholder="contact@co.com, ops@co.com" />
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.contactPhone} onChange={(e) => setNewRow((s) => ({ ...s, contactPhone: e.target.value }))} placeholder="(555) 555-5555" />
            <input className="admin-input" style={{ minWidth: 0 }} value={newRow.notes} onChange={(e) => setNewRow((s) => ({ ...s, notes: e.target.value }))} placeholder="Optional notes" />
            <button type="button" className="admin-btn" onClick={createRow} disabled={saving || !newRow.name.trim()}>
              Add Oil Company
            </button>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact Email</th>
                <th>Phone</th>
                <th>Notes</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isEditing = editingId === r._id;
                return (
                  <tr key={r._id}>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "160px" }} value={edit.name} onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))} /> : r.name}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "240px" }} value={edit.contactEmails} onChange={(e) => setEdit((s) => ({ ...s, contactEmails: e.target.value }))} placeholder="a@co.com, b@co.com" /> : (emailsToInput(r) || "—")}</td>
                    <td>{isEditing ? <input className="admin-input" value={edit.contactPhone} onChange={(e) => setEdit((s) => ({ ...s, contactPhone: e.target.value }))} /> : (r.contactPhone || "—")}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "220px" }} value={edit.notes} onChange={(e) => setEdit((s) => ({ ...s, notes: e.target.value }))} /> : (r.notes || "—")}</td>
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
