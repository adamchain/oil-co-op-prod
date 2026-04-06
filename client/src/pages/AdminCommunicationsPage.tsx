import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../authContext";

type Row = {
  _id: string;
  channel: string;
  subject: string;
  status: string;
  createdAt: string;
  memberId?: { memberNumber?: string; firstName?: string; lastName?: string; email?: string } | null;
};

export default function AdminCommunicationsPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!token) return;
    api<{ rows: Row[] }>("/api/admin/communications", { token }).then((r) => setRows(r.rows));
  }, [token]);

  const byStatus = useMemo(
    () =>
      rows.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {}),
    [rows]
  );

  return (
    <>
      <p style={{ color: "var(--admin-muted)", fontSize: "0.875rem", margin: "0 0 1rem" }}>
        Full communications log: email, letter queue, SMS placeholders, and oil company notifications.
      </p>
      <div className="admin-stats">
        <div className="admin-stat">
          <strong>{rows.length}</strong>
          <span>Recent logs</span>
        </div>
        <div className="admin-stat">
          <strong>{byStatus.sent || 0}</strong>
          <span>Sent</span>
        </div>
        <div className="admin-stat">
          <strong>{byStatus.failed || 0}</strong>
          <span>Failed</span>
        </div>
      </div>

      <div className="admin-card">
        <h2>Communications</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Member</th>
                <th>Channel</th>
                <th>Subject</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td>
                    {r.memberId?.memberNumber || "—"} {r.memberId?.firstName} {r.memberId?.lastName}
                  </td>
                  <td>{r.channel}</td>
                  <td>{r.subject || "—"}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
