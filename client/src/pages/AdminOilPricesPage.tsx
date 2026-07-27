import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../authContext";

type OilPrice = {
  _id: string;
  weekOf: string;
  coopPrice: number;
  statePrice: number | null;
  priceDifference: number | null;
  season: number | null;
  firstOfMonth?: boolean;
};

type Draft = {
  weekOf: string;
  coopPrice: string;
  statePrice: string;
  priceDifference: string;
  season: string;
  firstOfMonth: boolean;
};

const emptyDraft = (): Draft => ({
  weekOf: "",
  coopPrice: "",
  statePrice: "",
  priceDifference: "",
  season: "",
  firstOfMonth: false,
});

function toDraft(row: OilPrice): Draft {
  return {
    weekOf: row.weekOf,
    coopPrice: String(row.coopPrice),
    statePrice: row.statePrice != null ? String(row.statePrice) : "",
    priceDifference: row.priceDifference != null ? String(row.priceDifference) : "",
    season: row.season != null ? String(row.season) : "",
    firstOfMonth: Boolean(row.firstOfMonth),
  };
}

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

function draftToBody(draft: Draft) {
  const coopPrice = Number(draft.coopPrice);
  const statePrice = parseOptionalNumber(draft.statePrice);
  const priceDifference = parseOptionalNumber(draft.priceDifference);
  const season = parseOptionalNumber(draft.season);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.weekOf.trim())) {
    throw new Error("Week date must be YYYY-MM-DD");
  }
  if (!Number.isFinite(coopPrice) || coopPrice <= 0) {
    throw new Error("Co-op price must be a positive number");
  }
  if (statePrice !== null && Number.isNaN(statePrice)) {
    throw new Error("State price must be a number");
  }
  if (priceDifference !== null && Number.isNaN(priceDifference)) {
    throw new Error("Price difference must be a number");
  }
  if (season !== null && (Number.isNaN(season) || !Number.isInteger(season))) {
    throw new Error("Season must be a whole number (e.g. 26)");
  }
  return {
    weekOf: draft.weekOf.trim(),
    coopPrice,
    statePrice,
    priceDifference,
    season,
    firstOfMonth: draft.firstOfMonth,
  };
}

function formatDisplayDate(weekOf: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekOf);
  if (!m) return weekOf;
  return `${m[2]}/${m[3]}/${m[1].slice(2)}`;
}

function formatMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(3);
}

export default function AdminOilPricesPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<OilPrice[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Draft>(emptyDraft());
  const [newRow, setNewRow] = useState<Draft>(emptyDraft());
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    if (!token) return;
    const res = await api<{ oilPrices: OilPrice[] }>("/api/admin/oil-prices?limit=2000", { token });
    setRows(res.oilPrices || []);
  }

  useEffect(() => {
    void load().catch((e) => setMsg(e instanceof Error ? e.message : "Failed to load"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = `${r.weekOf} ${formatDisplayDate(r.weekOf)} ${r.coopPrice} ${r.statePrice ?? ""} ${r.season ?? ""}`;
      return hay.toLowerCase().includes(q);
    });
  }, [rows, query]);

  async function createRow() {
    if (!token) return;
    setSaving(true);
    setMsg("");
    try {
      const body = draftToBody(newRow);
      await api("/api/admin/oil-prices", { method: "POST", token, body: JSON.stringify(body) });
      setNewRow(emptyDraft());
      await load();
      setMsg("Price row added. The newest week shows on the homepage hero.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(id: string) {
    if (!token) return;
    setSaving(true);
    setMsg("");
    try {
      const body = draftToBody(edit);
      await api(`/api/admin/oil-prices/${id}`, { method: "PATCH", token, body: JSON.stringify(body) });
      setEditingId(null);
      await load();
      setMsg("Price row updated.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(id: string) {
    if (!token) return;
    if (!window.confirm("Delete this weekly price row?")) return;
    setSaving(true);
    setMsg("");
    try {
      await api(`/api/admin/oil-prices/${id}`, { method: "DELETE", token });
      setEditingId(null);
      await load();
      setMsg("Price row deleted.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  const latest = rows[0];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.35rem" }}>Oil prices</h1>
          <p style={{ margin: 0, color: "var(--admin-muted, #64748b)", fontSize: "0.92rem", maxWidth: "40rem" }}>
            Weekly Co-op and state averages shown on the public site. Newest week drives the homepage hero. Leave state
            price blank when EIA data is unavailable (typical after March).
          </p>
        </div>
        {latest && (
          <div
            style={{
              padding: "0.75rem 1rem",
              border: "1px solid #dde5dd",
              borderRadius: 10,
              background: "#f6faf6",
              minWidth: "11rem",
            }}
          >
            <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "#4b5850" }}>
              Current (hero)
            </div>
            <div style={{ fontSize: "1.35rem", fontWeight: 700 }}>${formatMoney(latest.coopPrice)}</div>
            <div style={{ fontSize: "0.85rem", color: "#4b5850" }}>week of {formatDisplayDate(latest.weekOf)}</div>
          </div>
        )}
      </div>

      {msg && (
        <p style={{ marginBottom: "0.75rem", color: msg.toLowerCase().includes("fail") ? "#b91c1c" : "#0e763c" }}>{msg}</p>
      )}

      <div className="admin-table-wrap" style={{ marginBottom: "1rem" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Week (YYYY-MM-DD)</th>
              <th>Co-op price</th>
              <th>State price</th>
              <th>Difference</th>
              <th>Season</th>
              <th>1st of month</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <input
                  type="date"
                  value={newRow.weekOf}
                  onChange={(e) => setNewRow((d) => ({ ...d, weekOf: e.target.value }))}
                />
              </td>
              <td>
                <input
                  inputMode="decimal"
                  placeholder="4.565"
                  value={newRow.coopPrice}
                  onChange={(e) => setNewRow((d) => ({ ...d, coopPrice: e.target.value }))}
                  style={{ width: "6rem" }}
                />
              </td>
              <td>
                <input
                  inputMode="decimal"
                  placeholder="optional"
                  value={newRow.statePrice}
                  onChange={(e) => setNewRow((d) => ({ ...d, statePrice: e.target.value }))}
                  style={{ width: "6rem" }}
                />
              </td>
              <td>
                <input
                  inputMode="decimal"
                  placeholder="auto"
                  value={newRow.priceDifference}
                  onChange={(e) => setNewRow((d) => ({ ...d, priceDifference: e.target.value }))}
                  style={{ width: "6rem" }}
                  title="Leave blank to auto-calculate from state − coop"
                />
              </td>
              <td>
                <input
                  inputMode="numeric"
                  placeholder="26"
                  value={newRow.season}
                  onChange={(e) => setNewRow((d) => ({ ...d, season: e.target.value }))}
                  style={{ width: "4rem" }}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={newRow.firstOfMonth}
                  onChange={(e) => setNewRow((d) => ({ ...d, firstOfMonth: e.target.checked }))}
                />
              </td>
              <td>
                <button type="button" className="admin-btn" disabled={saving} onClick={() => void createRow()}>
                  Add
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginBottom: "0.75rem" }}>
        <input
          type="search"
          placeholder="Search by week or price…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: "min(20rem, 100%)", padding: "0.45rem 0.65rem" }}
        />
        <span style={{ marginLeft: "0.75rem", fontSize: "0.85rem", color: "#64748b" }}>
          {filtered.length} of {rows.length} rows
        </span>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Week</th>
              <th>Avg. Co-op</th>
              <th>Avg. State</th>
              <th>Difference</th>
              <th>Season</th>
              <th>1st / mo</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const isEditing = editingId === row._id;
              return (
                <tr key={row._id}>
                  {isEditing ? (
                    <>
                      <td>
                        <input
                          type="date"
                          value={edit.weekOf}
                          onChange={(e) => setEdit((d) => ({ ...d, weekOf: e.target.value }))}
                        />
                      </td>
                      <td>
                        <input
                          value={edit.coopPrice}
                          onChange={(e) => setEdit((d) => ({ ...d, coopPrice: e.target.value }))}
                          style={{ width: "6rem" }}
                        />
                      </td>
                      <td>
                        <input
                          value={edit.statePrice}
                          onChange={(e) => setEdit((d) => ({ ...d, statePrice: e.target.value }))}
                          style={{ width: "6rem" }}
                        />
                      </td>
                      <td>
                        <input
                          value={edit.priceDifference}
                          onChange={(e) => setEdit((d) => ({ ...d, priceDifference: e.target.value }))}
                          style={{ width: "6rem" }}
                          placeholder="auto"
                        />
                      </td>
                      <td>
                        <input
                          value={edit.season}
                          onChange={(e) => setEdit((d) => ({ ...d, season: e.target.value }))}
                          style={{ width: "4rem" }}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={edit.firstOfMonth}
                          onChange={(e) => setEdit((d) => ({ ...d, firstOfMonth: e.target.checked }))}
                        />
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button type="button" className="admin-btn" disabled={saving} onClick={() => void saveEdit(row._id)}>
                          Save
                        </button>{" "}
                        <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        {formatDisplayDate(row.weekOf)}
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{row.weekOf}</div>
                      </td>
                      <td>{formatMoney(row.coopPrice)}</td>
                      <td>{formatMoney(row.statePrice)}</td>
                      <td>{formatMoney(row.priceDifference)}</td>
                      <td>{row.season ?? "—"}</td>
                      <td>{row.firstOfMonth ? "Yes" : ""}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          className="admin-btn admin-btn-ghost"
                          onClick={() => {
                            setEditingId(row._id);
                            setEdit(toDraft(row));
                          }}
                        >
                          Edit
                        </button>{" "}
                        <button
                          type="button"
                          className="admin-btn admin-btn-ghost"
                          disabled={saving}
                          onClick={() => void deleteRow(row._id)}
                        >
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "#64748b" }}>
                  No price rows yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
