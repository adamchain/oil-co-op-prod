import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../authContext";

type Task = {
  type: string;
  priority: string;
  createdAt: string;
  detail: string;
  member?: { _id?: string; memberNumber?: string; firstName?: string; lastName?: string; email?: string } | null;
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

function getPriorityStyle(priority: string) {
  switch (priority) {
    case "high":
      return { background: "#fef2f2", color: "#991b1b" };
    case "medium":
      return { background: "#fef3c7", color: "#92400e" };
    default:
      return { background: "#f5f5f4", color: "#57534e" };
  }
}

function getTypeLabel(type: string) {
  const labels: Record<string, string> = {
    failed_annual_charge: "Failed Payment",
    manual_payment_followup: "Manual Follow-up",
    oil_company_assignment_needed: "Needs Oil Co.",
    communication_failed: "Failed Email",
  };
  return labels[type] || type;
}

export default function AdminExceptionsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<ExceptionData | null>(null);

  useEffect(() => {
    if (!token) return;
    api<ExceptionData>("/api/admin/exceptions", { token }).then(setData);
  }, [token]);

  if (!data) {
    return (
      <div className="admin-minimal">
        <p style={{ color: "#78716c" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="admin-minimal">
      {/* Summary Cards */}
      <section className="admin-minimal-section">
        <h2 className="admin-minimal-heading">Overview</h2>
        <div className="admin-minimal-table-wrap">
          <table className="admin-minimal-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Count</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Failed Payments</td>
                <td className="admin-minimal-table-count">{data.summary.failedAnnualCount}</td>
                <td>
                  <span
                    className="admin-minimal-status"
                    style={data.summary.failedAnnualCount > 0 ? { background: "#fef2f2", color: "#991b1b" } : { background: "#ecfdf5", color: "#065f46" }}
                  >
                    {data.summary.failedAnnualCount > 0 ? "Needs attention" : "Clear"}
                  </span>
                </td>
              </tr>
              <tr>
                <td>Manual Follow-ups</td>
                <td className="admin-minimal-table-count">{data.summary.pendingManualCount}</td>
                <td>
                  <span
                    className="admin-minimal-status"
                    style={data.summary.pendingManualCount > 0 ? { background: "#fef3c7", color: "#92400e" } : { background: "#ecfdf5", color: "#065f46" }}
                  >
                    {data.summary.pendingManualCount > 0 ? "Pending" : "Clear"}
                  </span>
                </td>
              </tr>
              <tr>
                <td>Missing Oil Company</td>
                <td className="admin-minimal-table-count">{data.summary.unassignedOilCompanyCount}</td>
                <td>
                  <span
                    className="admin-minimal-status"
                    style={data.summary.unassignedOilCompanyCount > 0 ? { background: "#fef3c7", color: "#92400e" } : { background: "#ecfdf5", color: "#065f46" }}
                  >
                    {data.summary.unassignedOilCompanyCount > 0 ? "Unassigned" : "Clear"}
                  </span>
                </td>
              </tr>
              <tr>
                <td>Failed Communications</td>
                <td className="admin-minimal-table-count">{data.summary.failedCommunicationCount}</td>
                <td>
                  <span
                    className="admin-minimal-status"
                    style={data.summary.failedCommunicationCount > 0 ? { background: "#f5f5f4", color: "#57534e" } : { background: "#ecfdf5", color: "#065f46" }}
                  >
                    {data.summary.failedCommunicationCount > 0 ? "Review" : "Clear"}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Task Queue */}
      <section className="admin-minimal-section">
        <h2 className="admin-minimal-heading">Task queue ({data.tasks.length})</h2>
        {data.tasks.length === 0 ? (
          <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "12px", padding: "2rem", textAlign: "center" }}>
            <p style={{ margin: 0, color: "#065f46", fontWeight: 500 }}>All clear! No tasks need attention.</p>
          </div>
        ) : (
          <div className="admin-minimal-table-wrap">
            <table className="admin-minimal-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Member</th>
                  <th>Detail</th>
                  <th>Priority</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.tasks.map((t, i) => (
                  <tr key={`${t.type}-${i}`}>
                    <td style={{ fontWeight: 500 }}>{getTypeLabel(t.type)}</td>
                    <td>
                      {t.member?._id ? (
                        <Link to={`/admin/workbench?member=${t.member._id}`} style={{ color: "#c2410c", textDecoration: "none", fontWeight: 500 }}>
                          {t.member.firstName} {t.member.lastName}
                        </Link>
                      ) : t.member ? (
                        `${t.member.firstName || ""} ${t.member.lastName || ""}`.trim() || "—"
                      ) : (
                        "—"
                      )}
                      {t.member?.memberNumber && (
                        <span style={{ color: "#78716c", fontSize: "0.8125rem", marginLeft: "0.5rem" }}>
                          #{t.member.memberNumber}
                        </span>
                      )}
                    </td>
                    <td style={{ color: "#57534e", maxWidth: "300px" }}>{t.detail}</td>
                    <td>
                      <span className="admin-minimal-status" style={getPriorityStyle(t.priority)}>
                        {t.priority}
                      </span>
                    </td>
                    <td style={{ color: "#78716c", fontSize: "0.8125rem", whiteSpace: "nowrap" }}>
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
