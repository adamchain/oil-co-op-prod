import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../authContext";

type Task = {
  type: string;
  priority: string;
  createdAt: string;
  detail: string;
  member?: { memberNumber?: string; firstName?: string; lastName?: string; email?: string } | null;
};

type ExceptionData = {
  summary: {
    failedAnnualCount: number;
    pendingManualCount: number;
    unassignedOilCompanyCount: number;
    failedCommunicationCount: number;
    totalTasks: number;
  };
  tasks: Task[];
};

export default function AdminExceptionsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<ExceptionData | null>(null);

  useEffect(() => {
    if (!token) return;
    api<ExceptionData>("/api/admin/exceptions", { token }).then(setData);
  }, [token]);

  if (!data) return <p style={{ color: "var(--admin-muted)" }}>Loading…</p>;

  return (
    <>
      <p style={{ color: "var(--admin-muted)", fontSize: "0.875rem", margin: "0 0 1rem" }}>
        Exceptions & Tasks queue for non-standard cases (failed charges, missing assignments, failed comms).
      </p>

      <div className="admin-stats">
        <div className="admin-stat">
          <strong>{data.summary.totalTasks}</strong>
          <span>Total tasks</span>
        </div>
        <div className="admin-stat">
          <strong>{data.summary.failedAnnualCount}</strong>
          <span>Failed annuals</span>
        </div>
        <div className="admin-stat">
          <strong>{data.summary.pendingManualCount}</strong>
          <span>Manual follow-up</span>
        </div>
        <div className="admin-stat">
          <strong>{data.summary.unassignedOilCompanyCount}</strong>
          <span>Missing oil company</span>
        </div>
      </div>

      <div className="admin-card">
        <h2>Task Queue</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Priority</th>
                <th>Type</th>
                <th>Member</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {data.tasks.map((t, i) => (
                <tr key={`${t.type}-${i}`}>
                  <td>{new Date(t.createdAt).toLocaleString()}</td>
                  <td>{t.priority}</td>
                  <td>{t.type}</td>
                  <td>
                    {t.member?.memberNumber || "—"} {t.member?.firstName} {t.member?.lastName}
                  </td>
                  <td>{t.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
