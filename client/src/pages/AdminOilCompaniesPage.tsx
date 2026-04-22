import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../authContext";

type OilCompany = {
  _id: string;
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  active?: boolean;
};

type EditState = {
  name: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
};

function toEditState(oc: OilCompany): EditState {
  return {
    name: oc.name || "",
    contactEmail: oc.contactEmail || "",
    contactPhone: oc.contactPhone || "",
    notes: oc.notes || "",
  };
}

export default function AdminOilCompaniesPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<OilCompany[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState>({ name: "", contactEmail: "", contactPhone: "", notes: "" });
  const [newRow, setNewRow] = useState<EditState>({ name: "", contactEmail: "", contactPhone: "", notes: "" });
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
        body: JSON.stringify(edit),
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

  async function createRow() {
    if (!token || !newRow.name.trim()) return;
    setSaving(true);
    setMsg("");
    try {
      await api("/api/admin/oil-companies", {
        method: "POST",
        token,
        body: JSON.stringify(newRow),
      });
      setNewRow({ name: "", contactEmail: "", contactPhone: "", notes: "" });
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
        Manage oil company records. The contact email is used for automatic assignment notifications.
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
              <tr>
                <td>
                  <input className="admin-input" style={{ minWidth: "160px" }} value={newRow.name} onChange={(e) => setNewRow((s) => ({ ...s, name: e.target.value }))} placeholder="New company name" />
                </td>
                <td>
                  <input className="admin-input" style={{ minWidth: "200px" }} value={newRow.contactEmail} onChange={(e) => setNewRow((s) => ({ ...s, contactEmail: e.target.value }))} placeholder="contact@company.com" />
                </td>
                <td>
                  <input className="admin-input" value={newRow.contactPhone} onChange={(e) => setNewRow((s) => ({ ...s, contactPhone: e.target.value }))} placeholder="(555) 555-5555" />
                </td>
                <td>
                  <input className="admin-input" style={{ minWidth: "220px" }} value={newRow.notes} onChange={(e) => setNewRow((s) => ({ ...s, notes: e.target.value }))} placeholder="Optional notes" />
                </td>
                <td>—</td>
                <td>
                  <button type="button" className="admin-btn" onClick={createRow} disabled={saving || !newRow.name.trim()}>
                    Add
                  </button>
                </td>
              </tr>
              {rows.map((r) => {
                const isEditing = editingId === r._id;
                return (
                  <tr key={r._id}>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "160px" }} value={edit.name} onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))} /> : r.name}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "200px" }} value={edit.contactEmail} onChange={(e) => setEdit((s) => ({ ...s, contactEmail: e.target.value }))} /> : (r.contactEmail || "—")}</td>
                    <td>{isEditing ? <input className="admin-input" value={edit.contactPhone} onChange={(e) => setEdit((s) => ({ ...s, contactPhone: e.target.value }))} /> : (r.contactPhone || "—")}</td>
                    <td>{isEditing ? <input className="admin-input" style={{ minWidth: "220px" }} value={edit.notes} onChange={(e) => setEdit((s) => ({ ...s, notes: e.target.value }))} /> : (r.notes || "—")}</td>
                    <td>{r.active === false ? "inactive" : "active"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {isEditing ? (
                        <>
                          <button type="button" className="admin-btn" onClick={() => void saveEdit(r._id)} disabled={saving || !edit.name.trim()}>
                            Save
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
