import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import DeliveryHistoryModal from "../components/DeliveryHistoryModal";
import { useAuth } from "../authContext";

type OilCo = { _id: string; name: string };
type NoteEntry = { _id?: string; text: string; createdAt: string; createdBy: string };

type DeliveryHistoryRow = {
  _id?: string;
  dateDelivered: string;
  deliveryYear: number;
  fuelType: "OIL" | "PROPANE";
  gallons: number;
  source?: "manual" | "import" | "legacy";
};

function parseDeliveryRows(raw: unknown): DeliveryHistoryRow[] {
  if (!Array.isArray(raw)) return [];
  const out: DeliveryHistoryRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const dateDelivered = String(rec.dateDelivered || "");
    const deliveryYear = Number(rec.deliveryYear);
    const fuelTypeRaw = String(rec.fuelType || "OIL").toUpperCase();
    const gallons = Number(rec.gallons);
    if (!dateDelivered || !Number.isFinite(deliveryYear) || !Number.isFinite(gallons)) continue;
    if (fuelTypeRaw !== "OIL" && fuelTypeRaw !== "PROPANE") continue;
    const _id = typeof rec._id === "string" ? rec._id : undefined;
    const sourceRaw = String(rec.source || "");
    const source: DeliveryHistoryRow["source"] =
      sourceRaw === "manual" || sourceRaw === "import" || sourceRaw === "legacy"
        ? (sourceRaw as DeliveryHistoryRow["source"])
        : undefined;
    out.push({ _id, dateDelivered, deliveryYear, fuelType: fuelTypeRaw as "OIL" | "PROPANE", gallons, source });
  }
  return out.sort((a, b) => (a.dateDelivered < b.dateDelivered ? 1 : -1));
}

export default function AdminMemberPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [oilCos, setOilCos] = useState<OilCo[]>([]);
  const [data, setData] = useState<{
    member: {
      _id: string;
      firstName: string;
      lastName: string;
      email: string;
      memberNumber?: string;
      status: string;
      oilCompanyId?: string | { _id: string; name: string } | null;
      notes?: string;
      notesHistory?: NoteEntry[];
      nextAnnualBillingDate?: string;
      successfulReferralCount?: number;
      referralWaiveCredits?: number;
      lifetimeAnnualFeeWaived?: boolean;
      legacyProfile?: Record<string, unknown>;
    };
    billing: Array<{ _id: string; kind: string; status: string; amountCents: number; createdAt: string }>;
    activity: Array<{ action: string; createdAt: string }>;
  } | null>(null);
  const [oilId, setOilId] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("active");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [deliveryHistoryOpen, setDeliveryHistoryOpen] = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    api<{ oilCompanies: OilCo[] }>("/api/admin/oil-companies", { token }).then((r) => setOilCos(r.oilCompanies));
  }, [token, id]);

  useEffect(() => {
    if (!token || !id) return;
    api<NonNullable<typeof data>>(`/api/admin/members/${id}`, { token }).then((d) => {
      setData(d);
      const oc = d.member.oilCompanyId;
      setOilId(typeof oc === "object" && oc ? oc._id : typeof oc === "string" ? oc : "");
      setNotes(d.member.notes || "");
      setStatus(d.member.status);
    });
  }, [token, id]);

  async function save() {
    if (!token || !id) return;
    setSaving(true);
    setMsg("");
    try {
      await api(`/api/admin/members/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          oilCompanyId: oilId || null,
          status,
        }),
      });
      setMsg("Saved.");
      const d = await api<NonNullable<typeof data>>(`/api/admin/members/${id}`, { token });
      setData(d);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function addNote() {
    if (!token || !id || !newNote.trim()) return;
    setSaving(true);
    try {
      await api(`/api/admin/members/${id}/notes`, {
        method: "POST",
        token,
        body: JSON.stringify({ text: newNote.trim() }),
      });
      setNewNote("");
      const d = await api<NonNullable<typeof data>>(`/api/admin/members/${id}`, { token });
      setData(d);
      setMsg("Note added.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error adding note");
    } finally {
      setSaving(false);
    }
  }

  const lp = (data?.member?.legacyProfile || {}) as Record<string, unknown>;
  const legacyValue = (key: string) => String(lp[key] ?? "");

  if (!data) {
    return <p style={{ color: "var(--admin-muted)" }}>Loading…</p>;
  }

  const m = data.member;
  const selectedOilCo = oilCos.find((o) => o._id === oilId);
  const deliveryRows = parseDeliveryRows(lp.deliveryHistoryRows);

  async function refreshMember() {
    if (!token || !id) return;
    const d = await api<NonNullable<typeof data>>(`/api/admin/members/${id}`, { token });
    setData(d);
  }

  return (
    <>
      <p style={{ margin: "0 0 1rem" }}>
        <Link to="/admin/members" style={{ color: "var(--admin-accent)", fontWeight: 500, textDecoration: "none" }}>
          ← Members
        </Link>
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", margin: "0 0 0.25rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 600 }}>
          {m.firstName} {m.lastName}
        </h1>
        <button type="button" className="admin-btn admin-btn-primary" onClick={() => setDeliveryHistoryOpen(true)}>
          Delivery history
        </button>
      </div>
      <p style={{ color: "var(--admin-muted)", margin: "0 0 1.5rem", fontSize: "0.875rem" }}>
        {m.email} · {m.memberNumber} · Next June bill:{" "}
        {m.nextAnnualBillingDate ? new Date(m.nextAnnualBillingDate).toLocaleDateString() : "—"}
      </p>

      <div className="admin-card">
        <h2>Oil company assignment</h2>
        <p style={{ color: "var(--admin-muted)", fontSize: "0.8125rem", marginTop: 0 }}>
          Same workflow as the mock admin &quot;Oil Company Status&quot; block — staff picks the participating company
          after signup.
        </p>
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "block", fontSize: "0.7rem", textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.35rem" }}>
            Oil company
          </label>
          <select className="admin-input" value={oilId} onChange={(e) => setOilId(e.target.value)} style={{ width: "100%", maxWidth: "360px" }}>
            <option value="">— Not assigned —</option>
            {oilCos.map((o) => (
              <option key={o._id} value={o._id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "block", fontSize: "0.7rem", textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.35rem" }}>
            Status
          </label>
          <select className="admin-input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "100%", maxWidth: "240px" }}>
            <option value="active">active</option>
            <option value="expired">expired</option>
            <option value="cancelled">cancelled</option>
          </select>
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", fontSize: "0.7rem", textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.35rem" }}>
            Internal notes ({(m.notesHistory || []).length} saved)
          </label>
          <div style={{ border: "1px solid var(--admin-border)", borderRadius: "8px", padding: "0.75rem", maxHeight: "200px", overflowY: "auto", background: "#fafafa", marginBottom: "0.5rem", maxWidth: "640px" }}>
            {(m.notesHistory || []).length === 0 && !notes ? (
              <p style={{ color: "var(--admin-muted)", fontSize: "0.8rem", margin: 0 }}>No notes yet</p>
            ) : (
              <>
                {notes && (
                  <div style={{ paddingBottom: "0.5rem", borderBottom: "1px solid var(--admin-border)", marginBottom: "0.5rem" }}>
                    <div style={{ fontSize: "0.65rem", color: "var(--admin-muted)", marginBottom: "0.15rem" }}>Legacy Note</div>
                    <div style={{ fontSize: "0.85rem", whiteSpace: "pre-wrap" }}>{notes}</div>
                  </div>
                )}
                {[...(m.notesHistory || [])].reverse().map((note, i) => (
                  <div key={note._id || i} style={{ paddingBottom: "0.5rem", borderBottom: i < (m.notesHistory || []).length - 1 ? "1px solid var(--admin-border)" : "none", marginBottom: "0.5rem" }}>
                    <div style={{ fontSize: "0.65rem", color: "var(--admin-muted)", marginBottom: "0.15rem" }}>
                      {new Date(note.createdAt).toLocaleDateString()} {new Date(note.createdAt).toLocaleTimeString()} — {note.createdBy}
                    </div>
                    <div style={{ fontSize: "0.85rem", whiteSpace: "pre-wrap" }}>{note.text}</div>
                  </div>
                ))}
              </>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", maxWidth: "640px" }}>
            <textarea
              className="admin-input"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a new note..."
              rows={2}
              style={{ flex: 1, resize: "vertical" }}
            />
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              style={{ alignSelf: "flex-end" }}
              onClick={() => void addNote()}
              disabled={!newNote.trim() || saving}
            >
              Add Note
            </button>
          </div>
        </div>
        {msg && <p style={{ color: msg.includes("Error") ? "#b91c1c" : "var(--admin-text)", fontSize: "0.875rem" }}>{msg}</p>}
        <button type="button" className="admin-btn admin-btn-primary" onClick={() => void save()} disabled={saving}>
          Save
        </button>
      </div>

      <div className="admin-card">
        <h2>Legacy profile</h2>
        <p style={{ color: "var(--admin-muted)", fontSize: "0.8125rem", marginTop: 0 }}>
          Imported data from FileMaker database
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.75rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.65rem", textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.2rem" }}>Legacy ID</label>
            <input className="admin-input" readOnly value={legacyValue("legacyId") || "—"} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.65rem", textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.2rem" }}>Record Type</label>
            <input className="admin-input" readOnly value={legacyValue("recordType") || "—"} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.65rem", textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.2rem" }}>Import Source</label>
            <input className="admin-input" readOnly value={legacyValue("importSource") || "—"} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.65rem", textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.2rem" }}>Date Added</label>
            <input className="admin-input" readOnly value={legacyValue("dateAdd") || "—"} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.65rem", textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.2rem" }}>Date Updated</label>
            <input className="admin-input" readOnly value={legacyValue("dateUpdat") || "—"} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.65rem", textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.2rem" }}>Last User</label>
            <input className="admin-input" readOnly value={legacyValue("lastUser") || "—"} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.65rem", textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.2rem" }}>Oil Co Raw</label>
            <input className="admin-input" readOnly value={legacyValue("oilCoRaw") || "—"} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.65rem", textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.2rem" }}>Oil ID</label>
            <input className="admin-input" readOnly value={legacyValue("oilId") || "—"} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.65rem", textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.2rem" }}>First Name 2</label>
            <input className="admin-input" readOnly value={legacyValue("firstName2") || "—"} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.65rem", textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.2rem" }}>Last Name 2</label>
            <input className="admin-input" readOnly value={legacyValue("lastName2") || "—"} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.65rem", textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.2rem" }}>Mid Name 1</label>
            <input className="admin-input" readOnly value={legacyValue("midName1") || "—"} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.65rem", textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.2rem" }}>Mid Name 2</label>
            <input className="admin-input" readOnly value={legacyValue("midName2") || "—"} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.65rem", textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.2rem" }}>Company</label>
            <input className="admin-input" readOnly value={legacyValue("company") || "—"} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.65rem", textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.2rem" }}>Phone 2</label>
            <input className="admin-input" readOnly value={legacyValue("phone2") || "—"} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.65rem", textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.2rem" }}>Street No</label>
            <input className="admin-input" readOnly value={legacyValue("streetNo") || "—"} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.65rem", textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.2rem" }}>Apt No</label>
            <input className="admin-input" readOnly value={legacyValue("aptNo1") || "—"} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.65rem", textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.2rem" }}>Key Codes</label>
            <input className="admin-input" readOnly value={legacyValue("keyCodes") || "—"} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.65rem", textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.2rem" }}>Carrier Rt</label>
            <input className="admin-input" readOnly value={legacyValue("carrierRt") || "—"} style={{ width: "100%" }} />
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h2>Referrals & waivers</h2>
        <p style={{ margin: 0, fontSize: "0.875rem" }}>
          Successful referrals: <strong>{m.successfulReferralCount ?? 0}</strong> · Credits:{" "}
          <strong>{m.referralWaiveCredits ?? 0}</strong> · Lifetime annual waived:{" "}
          <strong>{m.lifetimeAnnualFeeWaived ? "Yes" : "No"}</strong>
        </p>
      </div>

      <div className="admin-card">
        <h2>Billing history</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Kind</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.billing.map((b) => (
                <tr key={b._id}>
                  <td>{new Date(b.createdAt).toLocaleString()}</td>
                  <td>{b.kind}</td>
                  <td>{b.status}</td>
                  <td>${(b.amountCents / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-card">
        <h2>Activity log</h2>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "var(--admin-muted)", fontSize: "0.8125rem" }}>
          {data.activity.slice(0, 20).map((a, i) => (
            <li key={i} style={{ marginBottom: "0.35rem" }}>
              {a.action} · {new Date(a.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      </div>

      <DeliveryHistoryModal
        open={deliveryHistoryOpen}
        onClose={() => setDeliveryHistoryOpen(false)}
        member={{
          memberNumber: m.memberNumber,
          createdAt: undefined,
          firstName: m.firstName,
          lastName: m.lastName,
          oilCoCode: String(lp.oilCoCode || ""),
          oilCompanyName: typeof m.oilCompanyId === "object" && m.oilCompanyId ? m.oilCompanyId.name : selectedOilCo?.name || "",
          oilId: String(lp.oilId || ""),
          oilStatus: String(lp.oilWorkbenchStatus || lp.workbenchMemberStatus || "UNKNOWN"),
          propCoCode: String(lp.propCoCode || ""),
          propaneCompanyName: String(lp.propaneCompanyName || ""),
          propaneId: String(lp.propaneId || ""),
          propaneStatus: String(lp.propaneStatus || "UNKNOWN"),
          deliveryHistory: Boolean(lp.deliveryHistory),
          delinquent: Boolean(lp.delinquent),
          notPaidCurrentYr: Boolean(lp.notPaidCurrentYr),
          nrdOil: Boolean(lp.nrdOil),
          nrdProp: Boolean(lp.nrdProp),
        }}
        deliveries={deliveryRows}
        onAddDelivery={
          token
            ? async (d) => {
                const r = await api<{ rows: DeliveryHistoryRow[] }>(
                  `/api/admin/deliveries/members/${m._id}`,
                  { method: "POST", token, body: JSON.stringify(d) }
                );
                await refreshMember();
                return r.rows;
              }
            : undefined
        }
        onUpdateDelivery={
          token
            ? async (rowId, d) => {
                const r = await api<{ rows: DeliveryHistoryRow[] }>(
                  `/api/admin/deliveries/members/${m._id}/${rowId}`,
                  { method: "PUT", token, body: JSON.stringify(d) }
                );
                await refreshMember();
                return r.rows;
              }
            : undefined
        }
        onDeleteDelivery={
          token
            ? async (rowId) => {
                const r = await api<{ rows: DeliveryHistoryRow[] }>(
                  `/api/admin/deliveries/members/${m._id}/${rowId}`,
                  { method: "DELETE", token }
                );
                await refreshMember();
                return r.rows;
              }
            : undefined
        }
      />
    </>
  );
}
