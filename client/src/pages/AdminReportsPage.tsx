import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../authContext";

type Summary = {
  totalMembers: number;
  activeMembers: number;
  membersByStatus: Record<string, number>;
  billingByKind: Record<string, { totalCents: number; count: number }>;
  totalReferralsRecorded: number;
  membersWithLifetimeAnnualWaiver: number;
  membersWithOilCompanyAssigned: number;
};

export default function AdminReportsPage() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [exportRows, setExportRows] = useState<Array<Record<string, unknown>> | null>(null);

  useEffect(() => {
    if (!token) return;
    api<Summary>("/api/admin/reports/summary", { token }).then(setSummary);
  }, [token]);

  async function loadExport() {
    if (!token) return;
    const to = new Date();
    const from = new Date();
    from.setFullYear(from.getFullYear() - 1);
    const r = await api<{ rows: Array<Record<string, unknown>> }>(
      `/api/admin/reports/billing-export?from=${from.toISOString()}&to=${to.toISOString()}`,
      { token }
    );
    setExportRows(r.rows);
  }

  if (!summary) return <p style={{ color: "var(--admin-muted)" }}>Loading…</p>;

  return (
    <>
      <p style={{ color: "var(--admin-muted)", fontSize: "0.875rem", margin: "0 0 1.25rem" }}>
        Manager reporting aligned with the membership plan — counts, billing aggregates, and export.
      </p>
      <div className="admin-stats">
        <div className="admin-stat">
          <strong>{summary.totalMembers}</strong>
          <span>Total members</span>
        </div>
        <div className="admin-stat">
          <strong>{summary.activeMembers}</strong>
          <span>Active</span>
        </div>
        <div className="admin-stat">
          <strong>{summary.membersWithOilCompanyAssigned}</strong>
          <span>Oil co assigned</span>
        </div>
        <div className="admin-stat">
          <strong>{summary.totalReferralsRecorded}</strong>
          <span>Referrals</span>
        </div>
        <div className="admin-stat">
          <strong>{summary.membersWithLifetimeAnnualWaiver}</strong>
          <span>Lifetime waiver</span>
        </div>
      </div>

      <div className="admin-card">
        <h2>Members by status</h2>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.875rem" }}>
          {Object.entries(summary.membersByStatus).map(([k, v]) => (
            <li key={k}>
              {k}: <strong>{v}</strong>
            </li>
          ))}
        </ul>
      </div>

      <div className="admin-card">
        <h2>Billing by kind</h2>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.875rem" }}>
          {Object.entries(summary.billingByKind).map(([k, v]) => (
            <li key={k}>
              {k}: <strong>${(v.totalCents / 100).toFixed(2)}</strong> ({v.count} events)
            </li>
          ))}
        </ul>
      </div>

      <div className="admin-card">
        <h2>Billing export (12 months)</h2>
        <button type="button" className="admin-btn" onClick={() => void loadExport()}>
          Load rows
        </button>
        {exportRows && (
          <div className="admin-table-wrap" style={{ marginTop: "1rem" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Kind</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Member #</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {exportRows.map((r, i) => (
                  <tr key={i}>
                    <td>{String(r.date)}</td>
                    <td>{String(r.kind)}</td>
                    <td>{String(r.status)}</td>
                    <td>${(Number(r.amountCents) / 100).toFixed(2)}</td>
                    <td>{String(r.memberNumber ?? "")}</td>
                    <td>{String(r.email ?? "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
