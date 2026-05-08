import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../authContext";

/**
 * Cross-member delivery summary search.
 *
 * Backed by GET /api/admin/deliveries/search. Search filters:
 *   - free-text q (member name, number, email, legacy id)
 *   - date range, year, month
 *   - fuel type
 *   - gallons range
 *   - company name (matches oil or propane company on member)
 *   - account # (matches oilId or propaneId on member)
 *
 * Returns flattened delivery rows joined with member identity, plus a
 * by-member rollup (count + total gallons) for top-line reporting.
 */

type Hit = {
  memberId: string;
  memberNumber: string;
  name: string;
  oilCompanyName: string;
  propaneCompanyName: string;
  oilId: string;
  propaneId: string;
  rowId: string;
  dateDelivered: string;
  fuelType: "OIL" | "PROPANE";
  gallons: number;
  source: string;
};

type SearchResponse = {
  summary: { totalRows: number; totalMembers: number; totalGallons: number; truncated: boolean };
  hits: Hit[];
  byMember: Array<{ memberId: string; memberNumber: string; name: string; rows: number; gallons: number }>;
};

const MONTHS = [
  "Any",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function AdminDeliverySearchPage() {
  const { token } = useAuth();
  const [filters, setFilters] = useState({
    q: "",
    from: "",
    to: "",
    year: "",
    month: "",
    fuel: "" as "" | "OIL" | "PROPANE",
    minGallons: "",
    maxGallons: "",
    companyName: "",
    account: "",
  });
  const [view, setView] = useState<"rows" | "byMember">("rows");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.q) p.set("q", filters.q);
    if (filters.from) p.set("from", filters.from);
    if (filters.to) p.set("to", filters.to);
    if (filters.year) p.set("year", filters.year);
    if (filters.month) p.set("month", filters.month);
    if (filters.fuel) p.set("fuel", filters.fuel);
    if (filters.minGallons) p.set("minGallons", filters.minGallons);
    if (filters.maxGallons) p.set("maxGallons", filters.maxGallons);
    if (filters.companyName) p.set("companyName", filters.companyName);
    if (filters.account) p.set("account", filters.account);
    p.set("limit", "1000");
    return p.toString();
  }, [filters]);

  async function runSearch() {
    if (!token) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<SearchResponse>(`/api/admin/deliveries/search?${queryString}`, { token });
      setData(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    void runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function exportCsv() {
    if (!data) return;
    const headers = [
      "memberNumber",
      "name",
      "fuelType",
      "dateDelivered",
      "gallons",
      "oilCompanyName",
      "propaneCompanyName",
      "oilId",
      "propaneId",
      "source",
    ];
    const lines = [headers.join(",")];
    for (const h of data.hits) {
      lines.push(
        headers
          .map((k) => {
            const v = (h as Record<string, unknown>)[k];
            if (v == null) return "";
            const s = String(v);
            return s.includes(",") || s.includes("\"") || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `delivery-summaries-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 600 }}>Delivery summaries — Search</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" className="admin-btn" onClick={exportCsv} disabled={!data || data.hits.length === 0}>
            Export CSV
          </button>
        </div>
      </div>
      <p style={{ color: "var(--admin-muted)", fontSize: "0.875rem", margin: "0.25rem 0 1.25rem" }}>
        Search across every member's delivery rows. Results show one line per delivery; switch to "By member" for
        per-customer rollups.
      </p>

      <div className="admin-card">
        <h2>Filters</h2>
        <div className="admin-delivery-search-grid">
          <Field label="Member text">
            <input
              className="admin-input"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Name, member #, email"
            />
          </Field>
          <Field label="Year">
            <input
              className="admin-input"
              value={filters.year}
              onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value.replace(/[^\d]/g, "").slice(0, 4) }))}
              placeholder="YYYY"
              inputMode="numeric"
            />
          </Field>
          <Field label="Month">
            <select
              className="admin-input"
              value={filters.month}
              onChange={(e) => setFilters((f) => ({ ...f, month: e.target.value }))}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i === 0 ? "" : String(i)}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="From">
            <input
              type="date"
              className="admin-input"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              className="admin-input"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            />
          </Field>
          <Field label="Fuel">
            <select
              className="admin-input"
              value={filters.fuel}
              onChange={(e) => setFilters((f) => ({ ...f, fuel: e.target.value as "" | "OIL" | "PROPANE" }))}
            >
              <option value="">Any</option>
              <option value="OIL">OIL</option>
              <option value="PROPANE">PROPANE</option>
            </select>
          </Field>
          <Field label="Min gallons">
            <input
              className="admin-input"
              value={filters.minGallons}
              onChange={(e) => setFilters((f) => ({ ...f, minGallons: e.target.value.replace(/[^\d.]/g, "") }))}
              placeholder="0"
              inputMode="decimal"
            />
          </Field>
          <Field label="Max gallons">
            <input
              className="admin-input"
              value={filters.maxGallons}
              onChange={(e) => setFilters((f) => ({ ...f, maxGallons: e.target.value.replace(/[^\d.]/g, "") }))}
              placeholder="∞"
              inputMode="decimal"
            />
          </Field>
          <Field label="Company name (exact)">
            <input
              className="admin-input"
              value={filters.companyName}
              onChange={(e) => setFilters((f) => ({ ...f, companyName: e.target.value }))}
              placeholder="e.g. Saveway Petroleum"
            />
          </Field>
          <Field label="Account # (oil or propane)">
            <input
              className="admin-input"
              value={filters.account}
              onChange={(e) => setFilters((f) => ({ ...f, account: e.target.value }))}
              placeholder="OIL-600499"
            />
          </Field>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
          <button type="button" className="admin-btn admin-btn-primary" onClick={() => void runSearch()} disabled={busy}>
            {busy ? "Searching…" : "Search"}
          </button>
          <button
            type="button"
            className="admin-btn"
            onClick={() =>
              setFilters({
                q: "",
                from: "",
                to: "",
                year: "",
                month: "",
                fuel: "",
                minGallons: "",
                maxGallons: "",
                companyName: "",
                account: "",
              })
            }
          >
            Clear
          </button>
        </div>
        {err && <p style={{ color: "#b91c1c", marginTop: "0.5rem", fontSize: "0.85rem" }}>{err}</p>}
      </div>

      {data && (
        <div className="admin-card">
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.85rem" }}>
                <strong>{data.summary.totalRows}</strong> deliveries
              </span>
              <span style={{ fontSize: "0.85rem" }}>
                <strong>{data.summary.totalMembers}</strong> members
              </span>
              <span style={{ fontSize: "0.85rem" }}>
                <strong>{data.summary.totalGallons.toFixed(1)}</strong> gallons total
              </span>
              {data.summary.truncated && (
                <span style={{ color: "#b45309", fontSize: "0.8rem" }}>(truncated; refine filters)</span>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.25rem" }}>
              <button
                type="button"
                className={`admin-btn${view === "rows" ? " admin-btn-primary" : ""}`}
                onClick={() => setView("rows")}
              >
                Rows
              </button>
              <button
                type="button"
                className={`admin-btn${view === "byMember" ? " admin-btn-primary" : ""}`}
                onClick={() => setView("byMember")}
              >
                By member
              </button>
            </div>
          </div>

          {view === "rows" ? (
            <div className="admin-table-wrap" style={{ marginTop: "0.75rem", maxHeight: "60vh", overflowY: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Fuel</th>
                    <th>Gallons</th>
                    <th>Member</th>
                    <th>Member #</th>
                    <th>Company</th>
                    <th>Account</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {data.hits.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ color: "var(--admin-muted)", fontStyle: "italic" }}>
                        No deliveries match these filters.
                      </td>
                    </tr>
                  ) : (
                    data.hits.map((h) => (
                      <tr key={`${h.memberId}-${h.rowId}`}>
                        <td>{h.dateDelivered}</td>
                        <td>{h.fuelType}</td>
                        <td>{h.gallons.toFixed(1)}</td>
                        <td>
                          <Link to={`/admin/workbench?member=${h.memberId}`}>{h.name || "(unnamed)"}</Link>
                        </td>
                        <td>{h.memberNumber || "—"}</td>
                        <td>{h.fuelType === "OIL" ? h.oilCompanyName || "—" : h.propaneCompanyName || "—"}</td>
                        <td>{h.fuelType === "OIL" ? h.oilId || "—" : h.propaneId || "—"}</td>
                        <td>{h.source}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-table-wrap" style={{ marginTop: "0.75rem", maxHeight: "60vh", overflowY: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Member #</th>
                    <th>Deliveries</th>
                    <th>Total gallons</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byMember.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ color: "var(--admin-muted)", fontStyle: "italic" }}>
                        No members match these filters.
                      </td>
                    </tr>
                  ) : (
                    data.byMember.map((m) => (
                      <tr key={m.memberId}>
                        <td>
                          <Link to={`/admin/workbench?member=${m.memberId}`}>{m.name}</Link>
                        </td>
                        <td>{m.memberNumber || "—"}</td>
                        <td>{m.rows}</td>
                        <td>{m.gallons.toFixed(1)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: 0 }}>
      <span style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--admin-muted)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}
